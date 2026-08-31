"""
Módulo financeiro: OPEX_FIXO_CAPEX (2% CAPEX + TUST-C/TUST-G), custos
operacionais ano a ano, fluxo de caixa, VPL, TIR e o BID de equilíbrio
(resolvido via busca de raiz, VPL=0).

Portado dos Blocos 7 (fim) e 8 do notebook.
"""
from __future__ import annotations

from dataclasses import replace

import numpy as np
import pandas as pd
from scipy.optimize import brentq

from .config import ConfigBESSDetalhado, ConfigFinanceiraDetalhada


def calcular_opex_fixo_capex(trajetoria: pd.DataFrame, cfg: ConfigBESSDetalhado,
                              fin: ConfigFinanceiraDetalhada) -> ConfigFinanceiraDetalhada:
    """OPEX_FIXO_CAPEX = 2% x CAPEX + (TUST-C + TUST-G) x 12 (uma única linha,
    já consolidada). Base de potência para TUST-C/TUST-G: a MAIOR capacidade
    líquida no POI ao longo dos 15 anos, convertida em potência via C-rate —
    a capacidade de pico contratada/declarada.

    Retorna uma NOVA `fin` (dataclass é frozen) com os campos derivados preenchidos.
    """
    potencia_referencia_tust_mw = trajetoria.capacidade_liquida_poi_mwh.max() * cfg.c_rate

    tust_c_mensal_rs = fin.tarifa_tust_c_rs_kw_mes * potencia_referencia_tust_mw * 1000  # MW -> kW
    tust_g_mensal_rs = fin.tarifa_tust_g_rs_kw_mes * potencia_referencia_tust_mw * 1000

    opex_fixo_capex_rs_ano = (
        fin.opex_fixo_pct_capex * fin.capex_total_rs
        + (tust_c_mensal_rs + tust_g_mensal_rs) * 12
    )

    return replace(
        fin,
        potencia_referencia_tust_mw=potencia_referencia_tust_mw,
        opex_fixo_capex_rs_ano=opex_fixo_capex_rs_ano,
    )


def custos_operacionais_ano(row: pd.Series, fin: ConfigFinanceiraDetalhada) -> float:
    opex_fixo_capex = fin.opex_fixo_capex_rs_ano
    custo_variavel = row.energia_liquida_poi_mwh_ano * fin.custo_variavel_rs_mwh
    custo_perdas = row.perdas_mwh_ano * fin.preco_energia_perdas_rs_mwh
    custo_nao_atendimento = row.deficit_descarga_mwh_ano * fin.custo_nao_atendimento_rs_mwh
    return opex_fixo_capex + custo_variavel + custo_perdas + custo_nao_atendimento + row.custo_augmentation_rs


def detalhar_custos_operacionais_ano(row: pd.Series, fin: ConfigFinanceiraDetalhada) -> dict:
    return {
        'opex_fixo_capex_rs': fin.opex_fixo_capex_rs_ano,
        'custo_variavel_rs': row.energia_liquida_poi_mwh_ano * fin.custo_variavel_rs_mwh,
        'custo_perdas_rs': row.perdas_mwh_ano * fin.preco_energia_perdas_rs_mwh,
        'custo_nao_atendimento_rs': row.deficit_descarga_mwh_ano * fin.custo_nao_atendimento_rs_mwh,
        'custo_augmentation_rs': row.custo_augmentation_rs,
    }


def montar_fluxo_caixa_detalhado(bid_rs_ano: float, trajetoria: pd.DataFrame,
                                  fin: ConfigFinanceiraDetalhada) -> np.ndarray:
    fluxo = np.zeros(fin.prazo_anos + 1)
    fluxo[0] = -fin.capex_total_rs
    for _, row in trajetoria.iterrows():
        fluxo[int(row.ano)] = bid_rs_ano - row.custo_operacional_rs_ano
    soh_final = trajetoria.iloc[-1].soh_fim_ano
    fluxo[-1] += fin.valor_residual_pct_capex * fin.capex_total_rs * soh_final
    return fluxo


def calcular_vpl_detalhado(bid_rs_ano: float, trajetoria: pd.DataFrame,
                            fin: ConfigFinanceiraDetalhada) -> float:
    fluxo = montar_fluxo_caixa_detalhado(bid_rs_ano, trajetoria, fin)
    anos = np.arange(len(fluxo))
    return float(np.sum(fluxo / (1 + fin.taxa_desconto_real) ** anos))


def calcular_tir(fluxo: np.ndarray, chute_min: float = -0.99, chute_max: float = 5.0) -> float:
    def vpl_na_taxa(taxa):
        anos = np.arange(len(fluxo))
        return np.sum(fluxo / (1 + taxa) ** anos)
    try:
        return float(brentq(vpl_na_taxa, chute_min, chute_max))
    except ValueError:
        return float('nan')


def resolver_bid_equilibrio(trajetoria: pd.DataFrame, fin: ConfigFinanceiraDetalhada) -> float:
    """Busca de raiz: o BID anual constante que zera o VPL do projeto.
    Limite superior de busca dinâmico — evita que a busca quebre caso algum
    custo exija um BID muito maior que o próprio CAPEX para fechar o VPL em zero
    (ex.: uma tarifa configurada com unidade errada gerando custo fora de escala)."""
    limite_superior_busca = max(fin.capex_total_rs, trajetoria.custo_operacional_rs_ano.max() * 3)
    return float(brentq(
        lambda bid: calcular_vpl_detalhado(bid, trajetoria, fin),
        a=0.0, b=limite_superior_busca
    ))


def calcular_sensibilidade_bid(trajetoria: pd.DataFrame, fin: ConfigFinanceiraDetalhada,
                                bid_equilibrio: float, n_pontos: int = 13,
                                faixa_min: float = 0.85, faixa_max: float = 1.15) -> list[dict]:
    """Tabela 'BID testado x VPL x TIR' (a mesma do notebook, Bloco 8.1): varia
    o BID contratado de 85% a 115% do BID de equilíbrio e mostra o VPL e a TIR
    resultantes para cada um. Barato — reaproveita a MESMA trajetória de 15
    anos já calculada, só resolve VPL/TIR de novo pra cada BID testado (nada
    de rodar a simulação inteira outra vez, ao contrário do Bloco 8.2)."""
    linhas = []
    for fracao in np.linspace(faixa_min, faixa_max, n_pontos):
        bid_testado = float(bid_equilibrio * fracao)
        fluxo_teste = montar_fluxo_caixa_detalhado(bid_testado, trajetoria, fin)
        linhas.append({
            'bid_testado_rs_ano': bid_testado,
            'bid_sobre_equilibrio': float(fracao),
            'vpl_rs': calcular_vpl_detalhado(bid_testado, trajetoria, fin),
            'tir_pct_aa': 100 * calcular_tir(fluxo_teste),
        })
    return linhas
