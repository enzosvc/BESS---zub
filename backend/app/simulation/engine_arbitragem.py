"""
Orquestrador do pipeline de ARBITRAGEM — equivalente a engine.py, mas para o
modelo de negócio de arbitragem (standalone ou FV+BESS).

Roda: ordens ano a ano (a partir do cenário de preço) -> trajetória de 15 anos
(SOH, augmentation, receita real) -> OPEX/TUST -> fluxo de caixa -> VPL/TIR.

Sem BID de equilíbrio (não existe "preço contratado" a resolver) e sem
sensibilidade de BID — a "sensibilidade" natural deste modelo é rodar de novo
com outro cenário de preço ou outro RTE/CAPEX (o frontend chama /simulate de
novo com inputs diferentes; não há um job assíncrono dedicado nesta v1).
"""
from __future__ import annotations

from dataclasses import replace
from typing import Dict

import numpy as np
import pandas as pd

from .config import ConfigBESSDetalhado, validar_curvas_vs_prazo
from ..version import obter_versao_modelo
from .orders_arbitragem import criar_ordens_arbitragem
from .lifecycle_arbitragem import simular_15_anos_arbitragem
from .financial_arbitragem import (
    ConfigFinanceiraArbitragem,
    calcular_opex_fixo_capex_arbitragem,
    custos_operacionais_ano_arbitragem,
    montar_fluxo_caixa_arbitragem,
    calcular_vpl,
)
from .financial import calcular_tir  # genérico, sem nada específico de LRCAP
from .json_safe import sanear_json


def _df_para_records(df: pd.DataFrame) -> list[dict]:
    df_limpo = df.replace({np.nan: None})
    return df_limpo.to_dict(orient='records')


def rodar_simulacao_arbitragem(cfg: ConfigBESSDetalhado, fin: ConfigFinanceiraArbitragem,
                                cenario_precos_por_ano: Dict[int, pd.DataFrame],
                                seed: int = 2026) -> dict:
    """
    cenario_precos_por_ano: {1: df_precos_ano1, ..., N: df_precos_anoN}, cada df
    com colunas ['data_hora', 'preco_rs_mwh'] cobrindo um ano calendário completo
    em resolução horária (ver orders_arbitragem.criar_ordens_arbitragem).

    O horizonte EFETIVO da análise é `min(cfg.prazo_anos, len(cenario_precos_por_ano))`
    — a análise nunca vai além do prazo do contrato NEM além do último ano com
    dado de preço real disponível no cenário. Se o cenário tiver menos anos que
    o contrato, `cfg`/`fin` são truncados para esse horizonte menor antes de
    rodar o resto do pipeline (SOH, augmentation, fluxo de caixa, VPL/TIR) —
    não há extrapolação nem repetição de anos.
    """
    if cfg.dias_simulados_por_ano != 365:
        raise ValueError(
            "Para o modelo de arbitragem, construa cfg com dias_simulados_por_ano=365 "
            "(o motor roda o ano inteiro vindo do cenário de preço, sem extrapolação "
            "de um período representativo menor)."
        )

    prazo_anos_solicitado = cfg.prazo_anos
    horizonte_efetivo_anos = min(cfg.prazo_anos, len(cenario_precos_por_ano))
    if horizonte_efetivo_anos < 1:
        raise ValueError("Cenário de preço sem nenhum ano utilizável.")

    horizonte_truncado = horizonte_efetivo_anos < prazo_anos_solicitado
    if horizonte_truncado:
        # cfg/fin são frozen — validar_curvas_vs_prazo já garantiu que as curvas de
        # RTE/SOH têm elementos suficientes para prazo_anos_solicitado, logo também
        # têm para o horizonte (menor) efetivo; nenhuma validação extra é necessária.
        cfg = replace(cfg, prazo_anos=horizonte_efetivo_anos)
        fin = replace(fin, prazo_anos=horizonte_efetivo_anos)

    validar_curvas_vs_prazo(cfg)

    anos_usados = sorted(cenario_precos_por_ano.keys())[:horizonte_efetivo_anos]
    ordens_por_ano = {
        ano_simulado: criar_ordens_arbitragem(cfg, cenario_precos_por_ano[ano_origem])
        for ano_simulado, ano_origem in enumerate(anos_usados, start=1)
    }

    trajetoria = simular_15_anos_arbitragem(ordens_por_ano, cfg, fin, seed=seed)

    fin = calcular_opex_fixo_capex_arbitragem(trajetoria, fin, cfg.c_rate)

    trajetoria['custo_operacional_rs_ano'] = trajetoria.apply(
        lambda r: custos_operacionais_ano_arbitragem(r, fin), axis=1
    )

    fluxo_caixa = montar_fluxo_caixa_arbitragem(trajetoria, fin)
    vpl = calcular_vpl(fluxo_caixa, fin.taxa_desconto_real)
    tir = calcular_tir(fluxo_caixa)

    duracao_h = int(round(1 / cfg.c_rate))

    # perfil de despacho: resumo dos primeiros 30 dias do ano 1, só para plotar no frontend
    # (evita devolver os 8760 pontos/ano x N anos por padrão)
    ordens_ano1 = ordens_por_ano[1]
    resumo_dias = sorted(ordens_ano1['dia'].unique())[:30]
    ordens_resumo = ordens_ano1[ordens_ano1['dia'].isin(resumo_dias)][
        ['data_hora', 'potencia_solicitada_mw', 'tipo_evento', 'ciclo_id', 'preco_rs_mwh']
    ].copy()
    ordens_resumo['data_hora'] = ordens_resumo['data_hora'].astype(str)

    return sanear_json({
        'versao_modelo': obter_versao_modelo(),
        'modelo_negocio': 'arbitragem_fv_bess' if fin.fv_acoplado else 'arbitragem_standalone',
        'horizonte_efetivo_anos': horizonte_efetivo_anos,
        'prazo_anos_solicitado': prazo_anos_solicitado,
        'horizonte_truncado': horizonte_truncado,
        'entrada': {
            'cfg': cfg.__dict__,
            'fin': fin.__dict__,
            'seed': seed,
            'duracao_arbitragem_h': duracao_h,
        },
        'perfil_ordens': {
            'series': _df_para_records(ordens_resumo),
            'duracao_h': duracao_h,
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
