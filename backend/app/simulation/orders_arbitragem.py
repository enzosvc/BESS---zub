"""
Geração do perfil de despacho para o modelo de negócio de ARBITRAGEM
(standalone ou acoplado a FV) — substitui `orders.py` (que é específico do
modelo LRCAP, com janelas fixas de carga/descarga).

Diferença estrutural para `orders.py`: ali, o MESMO perfil de ~30 dias é
reaproveitado (e extrapolado) para os 15 anos do contrato. Aqui, o despacho
muda todo santo dia, porque depende do preço real daquele dia — por isso a
função recebe o ANO CALENDÁRIO INTEIRO de preços e devolve o ANO INTEIRO de
ordens (sem extrapolação: `simular_ano_arbitragem` roda o ano cheio).

Estratégia de despacho: foresight perfeito (decisão de screening, não uma
heurística operacional realista) — em cada dia, carrega nas D horas mais
baratas e descarrega nas D horas mais caras do MESMO dia, onde
D = round(1 / cfg.c_rate) horas (a duração nominal do BESS). Essa é a mesma
lógica usada na análise de potencial teórico (planilha/HTML de screening);
aqui ela vira o motor de despacho ano a ano, encaixado no mesmo laço físico
(SOC, eficiência, perdas) que o modelo LRCAP usa.

Acoplamento com FV: esta função NÃO muda o formato do despacho (a decisão de
quais horas carregar/descarregar continua vindo do preço, como proxy de
"quando a energia está mais barata/abundante" — tipicamente as horas de sol).
O que muda com FV é só a parte financeira (financial_arbitragem.py): a
energia de carga passa a ter custo de oportunidade ~R$0 em vez do PLD da
hora. Ver a ressalva sobre essa simplificação no docstring de
`financial_arbitragem.py`.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import ConfigBESSDetalhado


def criar_ordens_arbitragem(cfg: ConfigBESSDetalhado, precos_ano: pd.DataFrame) -> pd.DataFrame:
    """
    precos_ano: DataFrame com colunas ['data_hora', 'preco_rs_mwh'], uma linha
    por hora, cobrindo EXATAMENTE um ano calendário (365 ou 366 dias x 24h,
    sem furos). `data_hora` deve ser tz-naive, resolução horária, ordenado.

    Retorna um DataFrame no mesmo formato usado por `criar_ordens_sinteticas`
    (compatível com `simular_ano_detalhado`), com `cfg.delta_t_h` implicitamente
    igual a 1.0 (a granularidade do PLD é horária — não há necessidade de
    granularidade de 15 min aqui, já que a decisão de despacho não muda dentro
    da hora).
    """
    if cfg.delta_t_h != 1.0:
        raise ValueError(
            f"criar_ordens_arbitragem exige cfg.delta_t_h == 1.0 (granularidade horária, "
            f"igual à do PLD); recebido delta_t_h={cfg.delta_t_h}. Para o motor de "
            f"arbitragem, construa o ConfigBESSDetalhado com delta_t_h=1.0."
        )

    precos_ano = precos_ano.sort_values('data_hora').reset_index(drop=True)
    n_horas = len(precos_ano)
    if n_horas % 24 != 0:
        raise ValueError(
            f"precos_ano tem {n_horas} linhas — esperado um múltiplo de 24 "
            f"(um ano calendário completo, sem furos nem duplicatas)."
        )

    duracao_h = int(round(1 / cfg.c_rate))
    duracao_h = max(1, min(duracao_h, 12))  # blindagem: duração de arbitragem não faz
    # sentido fora de 1-12h (acima disso já não sobram horas "caras" o suficiente no dia)

    precos_ano = precos_ano.copy()
    precos_ano['dia'] = precos_ano['data_hora'].dt.date
    precos_ano['hora_do_dia'] = precos_ano['data_hora'].dt.hour

    ordem = np.zeros(n_horas)
    tipo = np.full(n_horas, 'espera', dtype=object)
    ciclo_id = np.zeros(n_horas, dtype=int)

    potencia_mw = cfg.potencia_nominal_efetiva_mw

    for ciclo_num, (dia, grupo) in enumerate(precos_ano.groupby('dia', sort=True), start=1):
        idx_dia = grupo.index.to_numpy()
        precos_dia = grupo['preco_rs_mwh'].to_numpy()

        ordem_precos = np.argsort(precos_dia)  # crescente: baratas primeiro
        idx_carga = idx_dia[ordem_precos[:duracao_h]]
        idx_descarga = idx_dia[ordem_precos[-duracao_h:]]

        ordem[idx_carga] = -potencia_mw
        tipo[idx_carga] = 'carga_arbitragem'
        ciclo_id[idx_carga] = ciclo_num

        ordem[idx_descarga] = potencia_mw
        tipo[idx_descarga] = 'descarga_arbitragem'
        ciclo_id[idx_descarga] = ciclo_num

    df = pd.DataFrame({
        'data_hora': precos_ano['data_hora'].values,
        'dia': precos_ano['dia'].values,
        'hora': precos_ano['hora_do_dia'].astype(float).values,
        'dia_semana': precos_ano['data_hora'].dt.day_name().values,
        'fim_de_semana': (precos_ano['data_hora'].dt.dayofweek >= 5).values,
        'potencia_solicitada_mw': ordem,
        'tipo_evento': tipo,
        'ciclo_id': ciclo_id,
        'preco_rs_mwh': precos_ano['preco_rs_mwh'].values,  # usado por financial_arbitragem.py
    })

    n_dias_periodo = precos_ano['dia'].nunique()
    df.attrs['n_ciclos_periodo'] = n_dias_periodo  # 1 ciclo de arbitragem/dia
    df.attrs['n_dias_periodo'] = n_dias_periodo
    df.attrs['duracao_h'] = duracao_h
    return df
