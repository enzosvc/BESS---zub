"""
Orquestrador do pipeline completo — a função que a API chama.

Roda: ordens sintéticas -> trajetória de 15 anos -> OPEX/TUST -> custos ->
BID de equilíbrio -> VPL/TIR, e devolve tudo já em estruturas serializáveis
em JSON (listas/dicts, sem numpy/pandas), prontas pra virar gráficos no
frontend.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import ConfigBESSDetalhado, ConfigFinanceiraDetalhada, validar_curvas_vs_prazo
from .orders import criar_ordens_sinteticas
from .lifecycle import simular_15_anos
from .financial import (
    calcular_opex_fixo_capex,
    custos_operacionais_ano,
    detalhar_custos_operacionais_ano,
    montar_fluxo_caixa_detalhado,
    calcular_vpl_detalhado,
    calcular_tir,
    resolver_bid_equilibrio,
    calcular_sensibilidade_bid,
)


def _df_para_records(df: pd.DataFrame) -> list[dict]:
    """Converte um DataFrame em list[dict] limpo para JSON (sem NaN/numpy types)."""
    df_limpo = df.replace({np.nan: None})
    return df_limpo.to_dict(orient='records')


def rodar_simulacao_completa(cfg: ConfigBESSDetalhado, fin: ConfigFinanceiraDetalhada,
                              seed: int = 2026) -> dict:
    """Roda o pipeline inteiro (equivalente aos Blocos 3, 6, 7 e 8 do notebook)
    e devolve um dicionário JSON-serializável com todos os resultados."""

    validar_curvas_vs_prazo(cfg)

    # Bloco 3: perfil sintético de ordens
    ordens = criar_ordens_sinteticas(cfg, seed=seed)

    # Bloco 7: trajetória de 15 anos (degradação, SOH, augmentation)
    trajetoria = simular_15_anos(ordens, cfg, fin, seed=seed)

    # Bloco 7 (fim): OPEX_FIXO_CAPEX = 2% CAPEX + (TUST-C + TUST-G) x 12
    fin = calcular_opex_fixo_capex(trajetoria, cfg, fin)

    # Bloco 8: custos operacionais ano a ano
    trajetoria['custo_operacional_rs_ano'] = trajetoria.apply(
        lambda r: custos_operacionais_ano(r, fin), axis=1
    )
    detalhamento = [detalhar_custos_operacionais_ano(row, fin) for _, row in trajetoria.iterrows()]
    for i, linha in enumerate(detalhamento):
        linha['ano'] = int(trajetoria.iloc[i].ano)

    # Bloco 8: BID de equilíbrio, VPL, TIR
    bid_equilibrio = resolver_bid_equilibrio(trajetoria, fin)
    fluxo_caixa = montar_fluxo_caixa_detalhado(bid_equilibrio, trajetoria, fin)
    vpl = calcular_vpl_detalhado(bid_equilibrio, trajetoria, fin)
    tir = calcular_tir(fluxo_caixa)

    # Bloco 8.1: sensibilidade do BID testado (85%-115% do equilíbrio) x VPL x TIR
    sensibilidade_bid = calcular_sensibilidade_bid(trajetoria, fin, bid_equilibrio)

    # perfil de ordens: resumo (não devolvemos os 2880 pontos crus por padrão,
    # só o suficiente pra plotar o perfil de 30 dias no frontend)
    ordens_resumo = ordens[['data_hora', 'potencia_solicitada_mw', 'tipo_evento', 'ciclo_id']].copy()
    ordens_resumo['data_hora'] = ordens_resumo['data_hora'].astype(str)

    return {
        'entrada': {
            'cfg': cfg.__dict__,
            'fin': fin.__dict__,
            'seed': seed,
        },
        'perfil_ordens': {
            'series': _df_para_records(ordens_resumo),
            'n_ciclos_periodo': int(ordens.attrs['n_ciclos_periodo']),
            'n_dias_periodo': int(ordens.attrs['n_dias_periodo']),
            'ciclos_por_ano_extrapolado': ordens.attrs['n_ciclos_periodo'] * 365 / ordens.attrs['n_dias_periodo'],
        },
        'trajetoria_15_anos': _df_para_records(trajetoria),
        'detalhamento_custos': detalhamento,
        'fluxo_caixa_rs': fluxo_caixa.tolist(),
        'sensibilidade_bid': sensibilidade_bid,
        'resultado_financeiro': {
            'bid_equilibrio_rs_ano': bid_equilibrio,
            'vpl_no_bid_equilibrio_rs': vpl,
            'tir_pct_aa': 100 * tir,
            'wacc_pct_aa': 100 * fin.taxa_desconto_real,
            'opex_fixo_capex_rs_ano': fin.opex_fixo_capex_rs_ano,
            'potencia_referencia_tust_mw': fin.potencia_referencia_tust_mw,
        },
    }
