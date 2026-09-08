"""
Orquestrador do pipeline COLOCALIZADO — mesma espinha dorsal do
engine_arbitragem.py (física, augmentation, financeiro, VPL/TIR são 100%
reaproveitados via lifecycle_arbitragem.py e financial_arbitragem.py). A
ÚNICA diferença real é a geração do despacho: em vez de
orders_arbitragem.criar_ordens_arbitragem (só preço), usa
orders_colocalizado.criar_ordens_colocalizado (preço + geração real da usina).

Carga sempre livre de custo (fin.fv_acoplado é forçado para True aqui,
independente do que vier no input) — é inerente ao modelo: a energia de
carga vem da geração própria da usina, não é comprada no mercado.

Pareamento dos cenários: `cenario_precos_por_ano` e `cenario_geracao_por_ano`
são pareados por POSIÇÃO (o 1º ano de preço com o 1º ano de geração, e assim
por diante) — não pela chave/rótulo de ano de cada upload, que são
sequências independentes. Isso assume que o usuário fez upload de períodos
correspondentes nos dois cenários (ex.: ambos 2024→hoje).
"""
from __future__ import annotations

from dataclasses import replace
from typing import Dict

import numpy as np
import pandas as pd

from .config import ConfigBESSDetalhado, validar_curvas_vs_prazo
from ..version import obter_versao_modelo
from .orders_colocalizado import criar_ordens_colocalizado
from .lifecycle_arbitragem import simular_15_anos_arbitragem
from .financial_arbitragem import (
    ConfigFinanceiraArbitragem,
    calcular_opex_fixo_capex_arbitragem,
    custos_operacionais_ano_arbitragem,
    montar_fluxo_caixa_arbitragem,
    calcular_vpl,
)
from .financial import calcular_tir
from .json_safe import sanear_json


def _df_para_records(df: pd.DataFrame) -> list[dict]:
    df_limpo = df.replace({np.nan: None})
    return df_limpo.to_dict(orient='records')


def rodar_simulacao_colocalizado(cfg: ConfigBESSDetalhado, fin: ConfigFinanceiraArbitragem,
                                  cenario_precos_por_ano: Dict[int, pd.DataFrame],
                                  cenario_geracao_por_ano: Dict[int, pd.DataFrame],
                                  seed: int = 2026) -> dict:
    if cfg.dias_simulados_por_ano != 365:
        raise ValueError(
            "Para o modelo colocalizado, construa cfg com dias_simulados_por_ano=365."
        )

    fin = replace(fin, fv_acoplado=True)  # carga sempre livre de custo, por definição do modelo

    prazo_anos_solicitado = cfg.prazo_anos
    horizonte_efetivo_anos = min(cfg.prazo_anos, len(cenario_precos_por_ano), len(cenario_geracao_por_ano))
    if horizonte_efetivo_anos < 1:
        raise ValueError("Cenário de preço e/ou UGC sem nenhum ano utilizável.")

    horizonte_truncado = horizonte_efetivo_anos < prazo_anos_solicitado
    if horizonte_truncado:
        cfg = replace(cfg, prazo_anos=horizonte_efetivo_anos)
        fin = replace(fin, prazo_anos=horizonte_efetivo_anos)

    validar_curvas_vs_prazo(cfg)

    anos_precos = sorted(cenario_precos_por_ano.keys())[:horizonte_efetivo_anos]
    anos_geracao = sorted(cenario_geracao_por_ano.keys())[:horizonte_efetivo_anos]

    ordens_por_ano = {
        ano_simulado: criar_ordens_colocalizado(
            cfg, cenario_precos_por_ano[ano_preco], cenario_geracao_por_ano[ano_geracao]
        )
        for ano_simulado, (ano_preco, ano_geracao) in enumerate(zip(anos_precos, anos_geracao), start=1)
    }

    trajetoria = simular_15_anos_arbitragem(ordens_por_ano, cfg, fin, seed=seed)

    fin = calcular_opex_fixo_capex_arbitragem(trajetoria, fin, cfg.c_rate)

    trajetoria['custo_operacional_rs_ano'] = trajetoria.apply(
        lambda r: custos_operacionais_ano_arbitragem(r, fin), axis=1
    )

    fluxo_caixa = montar_fluxo_caixa_arbitragem(trajetoria, fin)
    vpl = calcular_vpl(fluxo_caixa, fin.taxa_desconto_real)
    tir = calcular_tir(fluxo_caixa)

    ordens_ano1 = ordens_por_ano[1]
    resumo_dias = sorted(ordens_ano1['dia'].unique())[:30]
    ordens_resumo = ordens_ano1[ordens_ano1['dia'].isin(resumo_dias)][
        ['data_hora', 'potencia_solicitada_mw', 'tipo_evento', 'ciclo_id', 'preco_rs_mwh', 'geracao_mw']
    ].copy()
    ordens_resumo['data_hora'] = ordens_resumo['data_hora'].astype(str)

    return sanear_json({
        'versao_modelo': obter_versao_modelo(),
        'modelo_negocio': 'colocalizado',
        'horizonte_efetivo_anos': horizonte_efetivo_anos,
        'prazo_anos_solicitado': prazo_anos_solicitado,
        'horizonte_truncado': horizonte_truncado,
        'entrada': {
            'cfg': cfg.__dict__,
            'fin': fin.__dict__,
            'seed': seed,
        },
        'perfil_ordens': {
            'series': _df_para_records(ordens_resumo),
        },
        'trajetoria_15_anos': _df_para_records(trajetoria),
        'fluxo_caixa_rs': fluxo_caixa.tolist(),
        'resultado_financeiro': {
            'vpl_rs': vpl,
            'tir_pct_aa': 100 * tir,
            'wacc_pct_aa': 100 * fin.taxa_desconto_real,
            'opex_fixo_capex_rs_ano': fin.opex_fixo_capex_rs_ano,
            'potencia_referencia_tust_mw': fin.potencia_referencia_tust_mw,
            'receita_liquida_media_rs_ano': float(trajetoria['receita_liquida_arbitragem_rs_ano'].mean()),
            'receita_liquida_ano1_rs': float(trajetoria.iloc[0]['receita_liquida_arbitragem_rs_ano']),
        },
    })
