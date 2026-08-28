"""
Sensibilidade contínua do BID a 5 fatores: Perdas, SOH+RTE (agrupados —
características do fabricante da célula), Penalidades, TUST-C e TUST-G.

Portado do Bloco 8.2 do notebook. Para cada fator, varia de 0% (estado ideal)
a 100% (valor atual) em passos de 5%, interpolando em direção ao ideal (não
para zero bruto) — e recalcula a simulação de 15 anos inteira + o BID de
equilíbrio para cada ponto.

Esse bloco é o mais pesado do modelo (5 fatores x 21 pontos = 105 simulações
completas, ~90s) — é por isso que, na API, ele roda como job assíncrono em vez
de bloquear uma requisição HTTP comum.
"""
from __future__ import annotations

from dataclasses import replace
from typing import Callable

import numpy as np
import pandas as pd

from .config import ConfigBESSDetalhado, ConfigFinanceiraDetalhada
from .lifecycle import simular_15_anos
from .financial import calcular_opex_fixo_capex, custos_operacionais_ano, resolver_bid_equilibrio

FATORES = ['Perdas', 'SOH+RTE', 'Penalidades', 'TUST-C', 'TUST-G']


def montar_cenario_por_fracao(fator: str, fracao: float, cfg_base: ConfigBESSDetalhado,
                               fin_base: ConfigFinanceiraDetalhada):
    """fracao=1.0 -> valores atuais (baseline); fracao=0.0 -> estado ideal (sem o efeito)."""
    cfg_f, fin_f = cfg_base, fin_base

    if fator == 'Perdas':
        cfg_f = replace(
            cfg_base,
            perda_cabo_dc_ac_pct=cfg_base.perda_cabo_dc_ac_pct * fracao,
            eficiencia_pcs=1 - (1 - cfg_base.eficiencia_pcs) * fracao,
            perda_cabo_trafo_media_alta_pct=cfg_base.perda_cabo_trafo_media_alta_pct * fracao,
            eficiencia_transformador_media_pct=1 - (1 - cfg_base.eficiencia_transformador_media_pct) * fracao,
            perda_cabo_alta_tensao_pct=cfg_base.perda_cabo_alta_tensao_pct * fracao,
            consumo_auxiliares_mw=cfg_base.consumo_auxiliares_mw * fracao,
        )
    elif fator == 'SOH+RTE':
        cfg_f = replace(
            cfg_base,
            soh_referencia_por_ano=tuple(1 - (1 - v) * fracao for v in cfg_base.soh_referencia_por_ano),
            mean_rte_por_ano=tuple(1 - (1 - v) * fracao for v in cfg_base.mean_rte_por_ano),
        )
    elif fator == 'Penalidades':
        fin_f = replace(fin_base, custo_nao_atendimento_rs_mwh=fin_base.custo_nao_atendimento_rs_mwh * fracao)
    elif fator == 'TUST-C':
        fin_f = replace(fin_base, tarifa_tust_c_rs_kw_mes=fin_base.tarifa_tust_c_rs_kw_mes * fracao)
    elif fator == 'TUST-G':
        fin_f = replace(fin_base, tarifa_tust_g_rs_kw_mes=fin_base.tarifa_tust_g_rs_kw_mes * fracao)
    else:
        raise ValueError(f"fator desconhecido: {fator}")

    return cfg_f, fin_f


def calcular_bid_equilibrio_para_cenario(cfg_cenario: ConfigBESSDetalhado, fin_cenario: ConfigFinanceiraDetalhada,
                                          ordens: pd.DataFrame, seed: int = 2026) -> float:
    """Roda a trajetória de 15 anos e o BID de equilíbrio PRÓPRIOS deste cenário
    (não herda augmentation nem OPEX/TUST do baseline — cada cenário recalcula
    tudo com seu próprio cfg/fin)."""
    trajetoria_cenario = simular_15_anos(ordens, cfg_cenario, fin_cenario, seed)
    fin_cenario = calcular_opex_fixo_capex(trajetoria_cenario, cfg_cenario, fin_cenario)
    trajetoria_cenario['custo_operacional_rs_ano'] = trajetoria_cenario.apply(
        lambda r: custos_operacionais_ano(r, fin_cenario), axis=1
    )
    return resolver_bid_equilibrio(trajetoria_cenario, fin_cenario)


def calcular_curvas_sensibilidade(
    cfg: ConfigBESSDetalhado,
    fin: ConfigFinanceiraDetalhada,
    ordens: pd.DataFrame,
    bid_equilibrio_baseline: float,
    seed: int = 2026,
    passo: float = 0.05,
    progress_callback: Callable[[int, int], None] | None = None,
) -> pd.DataFrame:
    """Retorna um DataFrame longo com colunas: Fator, Item (%), BID (%).
    `progress_callback(feito, total)` é opcional — usado pelo worker assíncrono
    para atualizar o status do job no banco enquanto a conta roda."""
    fracoes = np.arange(0.0, 1.0001, passo)
    total = len(FATORES) * len(fracoes)
    feito = 0

    linhas = []
    for fator in FATORES:
        for fracao in fracoes:
            cfg_f, fin_f = montar_cenario_por_fracao(fator, float(fracao), cfg, fin)
            bid_f = calcular_bid_equilibrio_para_cenario(cfg_f, fin_f, ordens, seed)
            linhas.append({
                'fator': fator,
                'item_pct': 100 * fracao,
                'bid_pct': 100 * bid_f / bid_equilibrio_baseline,
            })
            feito += 1
            if progress_callback is not None:
                progress_callback(feito, total)

    return pd.DataFrame(linhas)
