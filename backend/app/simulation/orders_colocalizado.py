"""
Geração do perfil de despacho para o modelo de negócio COLOCALIZADO — BESS
que carrega com a geração REAL da usina (via UGC), em vez de decidir a carga
só pelo preço (como o Autônomo faz). A descarga continua guiada por preço,
usando o mesmo alocador de despacho_precos.py que o Autônomo usa — vende nas
horas mais caras do dia, ajustando a potência pra energia realmente
disponível (ver docstring de despacho_precos.py).

Diferença central pro Autônomo (orders_arbitragem.py):
  - Carga: min(geração_da_hora, potência_nominal), em TODA hora em que a
    usina gerou (não só as N horas mais baratas) — respeitando também o teto
    de energia diário do BESS (capacidade_nominal_mwh). Em dias de pouca
    geração, a bateria carrega menos que a capacidade cheia.
  - Descarga: sempre no MESMO dia, usando o alocador de preço pra energia
    que foi REALMENTE carregada naquele dia (pode ser menos que a capacidade
    cheia) — nunca mais do que foi carregado.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import ConfigBESSDetalhado
from .despacho_precos import alocar_descarga_por_preco


def criar_ordens_colocalizado(cfg: ConfigBESSDetalhado, precos_ano: pd.DataFrame,
                               geracao_ano: pd.DataFrame) -> pd.DataFrame:
    """
    precos_ano: DataFrame ['data_hora', 'preco_rs_mwh'].
    geracao_ano: DataFrame ['data_hora', 'geracao_mw'] — mesma granularidade
    horária, MESMO NÚMERO de horas que precos_ano pro ano em questão.
    """
    if cfg.delta_t_h != 1.0:
        raise ValueError("criar_ordens_colocalizado exige cfg.delta_t_h == 1.0 (granularidade horária).")

    precos_ano = precos_ano.sort_values('data_hora').reset_index(drop=True)
    geracao_ano = geracao_ano.sort_values('data_hora').reset_index(drop=True)

    if len(precos_ano) != len(geracao_ano):
        raise ValueError(
            f"Cenário de preço ({len(precos_ano)}h) e UGC ({len(geracao_ano)}h) não têm o "
            f"mesmo número de horas pra esse ano — confira se os dois cobrem o mesmo período."
        )

    n_horas = len(precos_ano)
    if n_horas % 24 != 0:
        raise ValueError(f"{n_horas} horas não é múltiplo de 24 (dias completos).")

    precos_ano = precos_ano.copy()
    precos_ano['dia'] = precos_ano['data_hora'].dt.date
    precos_ano['hora_do_dia'] = precos_ano['data_hora'].dt.hour
    precos_arr = precos_ano['preco_rs_mwh'].to_numpy()
    geracao_arr = geracao_ano['geracao_mw'].to_numpy()

    ordem = np.zeros(n_horas)
    tipo = np.full(n_horas, 'espera', dtype=object)
    ciclo_id = np.zeros(n_horas, dtype=int)

    potencia_mw = cfg.potencia_nominal_efetiva_mw
    capacidade_mwh = cfg.capacidade_nominal_mwh

    for ciclo_num, (dia, grupo) in enumerate(precos_ano.groupby('dia', sort=True), start=1):
        idx_dia = grupo.index.to_numpy()
        precos_dia = precos_arr[idx_dia]
        geracao_dia = geracao_arr[idx_dia]

        carga_horas = np.minimum(np.maximum(geracao_dia, 0), potencia_mw)
        carga_acumulada = np.cumsum(carga_horas)
        excesso_acumulado = np.maximum(carga_acumulada - capacidade_mwh, 0)
        reducao_por_hora = np.diff(np.concatenate(([0.0], excesso_acumulado)))
        carga_horas = np.maximum(carga_horas - np.maximum(reducao_por_hora, 0), 0)

        mascara_carga = carga_horas > 1e-9
        idx_carga = idx_dia[mascara_carga]
        ordem[idx_carga] = -carga_horas[mascara_carga]
        tipo[idx_carga] = 'carga_colocalizado'
        ciclo_id[idx_carga] = ciclo_num

        energia_carregada_mwh = carga_horas.sum()
        indices_dia_local = np.arange(len(idx_dia))
        indices_disponiveis = indices_dia_local[~mascara_carga]
        precos_disponiveis = precos_dia[indices_disponiveis]
        alocacao_parcial = alocar_descarga_por_preco(precos_disponiveis, energia_carregada_mwh, potencia_mw)

        mascara_parcial = alocacao_parcial > 0
        idx_descarga = idx_dia[indices_disponiveis[mascara_parcial]]
        ordem[idx_descarga] = alocacao_parcial[mascara_parcial]
        tipo[idx_descarga] = 'descarga_colocalizado'
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
        'preco_rs_mwh': precos_arr,
        'geracao_mw': geracao_arr,
    })

    n_dias_periodo = precos_ano['dia'].nunique()
    df.attrs['n_ciclos_periodo'] = n_dias_periodo
    df.attrs['n_dias_periodo'] = n_dias_periodo
    return df
