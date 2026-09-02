"""
Módulo financeiro do modelo de negócio de ARBITRAGEM (standalone ou BESS+FV).

Diferença estrutural para `financial.py` (LRCAP):
  - Não existe BID contratado nem busca de raiz para VPL=0 — a receita é o
    que o despacho realmente vendeu/comprou no PLD (ou de graça, se FV+BESS),
    ano a ano. O que se responde aqui é "esse fluxo de caixa dá VPL/TIR
    positivos?", não "que preço contratado equilibra o projeto?".
  - Não existe `custo_nao_atendimento_rs_mwh`: não há compromisso contratual
    de capacidade a cumprir, então não faz sentido penalizar déficit de
    descarga (menos energia despachada = simplesmente menos receita naquele
    dia, o próprio mercado já "pune" isso).

Simplificação assumida para o cenário FV+BESS (documentar para o usuário
final na UI): a energia de carga tem custo de oportunidade R$0, o que só é
válido se essa energia realmente seria perdida/curtailed sem o BESS. Se a FV
tem PPA ou é vendida no mercado livre com valor positivo, o custo de carga
real é esse valor perdido, não zero — trate o resultado FV+BESS como um
limite superior (best case), não uma média esperada.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class ConfigFinanceiraArbitragem:
    capex_total_rs: float
    opex_fixo_pct_capex: float
    custo_variavel_rs_mwh: float
    preco_energia_perdas_rs_mwh: float
    custo_augmentation_rs_mwh: float
    tarifa_tust_c_rs_kw_mes: float
    tarifa_tust_g_rs_kw_mes: float
    taxa_desconto_real: float
    prazo_anos: int
    valor_residual_pct_capex: float
    fv_acoplado: bool = False

    # Placeholder — preenchido via dataclasses.replace() depois que a trajetória de
    # capacidade líquida existe (mesma lógica de financial.py::calcular_opex_fixo_capex)
    potencia_referencia_tust_mw: float = 0.0
    opex_fixo_capex_rs_ano: float = 0.0


def calcular_receita_liquida_ano(ordens_ano: pd.DataFrame, pot_poi_entregue_mw_serie: np.ndarray,
                                  fv_acoplado: bool) -> dict:
    """Multiplica a potência REALMENTE entregue/absorvida no POI (já limitada
    pela física — SOC, potência máxima, disponibilidade do ano) pelo preço da
    hora correspondente. `pot_poi_entregue_mw_serie` e `ordens_ano['preco_rs_mwh']`
    têm o mesmo índice/ordem por construção (ambos vêm do mesmo DataFrame de ordens).

    delta_t_h = 1.0 sempre aqui (granularidade horária — ver orders_arbitragem.py).
    """
    preco = ordens_ano['preco_rs_mwh'].to_numpy()
    pot = np.asarray(pot_poi_entregue_mw_serie)

    energia_vendida_mwh = np.where(pot > 0, pot, 0.0)          # descarga -> vende no PLD
    energia_comprada_mwh = np.where(pot < 0, -pot, 0.0)        # carga -> compra no PLD (ou grátis, se FV)

    receita_venda_rs = float(np.sum(energia_vendida_mwh * preco))
    custo_compra_rs = 0.0 if fv_acoplado else float(np.sum(energia_comprada_mwh * preco))

    return {
        'energia_vendida_mwh_ano': float(energia_vendida_mwh.sum()),
        'energia_comprada_mwh_ano': float(energia_comprada_mwh.sum()),
        'receita_venda_rs_ano': receita_venda_rs,
        'custo_compra_rs_ano': custo_compra_rs,
        'receita_liquida_arbitragem_rs_ano': receita_venda_rs - custo_compra_rs,
    }


def calcular_opex_fixo_capex_arbitragem(trajetoria: pd.DataFrame,
                                         fin: ConfigFinanceiraArbitragem,
                                         c_rate: float) -> ConfigFinanceiraArbitragem:
    """Idêntico em espírito a financial.py::calcular_opex_fixo_capex — só
    reimplementado aqui para não acoplar os dois módulos financeiros."""
    from dataclasses import replace

    potencia_referencia_tust_mw = trajetoria.capacidade_liquida_poi_mwh.max() * c_rate
    tust_c_mensal_rs = fin.tarifa_tust_c_rs_kw_mes * potencia_referencia_tust_mw * 1000
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


def custos_operacionais_ano_arbitragem(row: pd.Series, fin: ConfigFinanceiraArbitragem) -> float:
    """SEM custo_nao_atendimento — ver docstring do módulo."""
    custo_variavel = row.energia_vendida_mwh_ano * fin.custo_variavel_rs_mwh
    custo_perdas = row.perdas_mwh_ano * fin.preco_energia_perdas_rs_mwh
    return fin.opex_fixo_capex_rs_ano + custo_variavel + custo_perdas + row.custo_augmentation_rs


def montar_fluxo_caixa_arbitragem(trajetoria: pd.DataFrame, fin: ConfigFinanceiraArbitragem) -> np.ndarray:
    fluxo = np.zeros(fin.prazo_anos + 1)
    fluxo[0] = -fin.capex_total_rs
    for _, row in trajetoria.iterrows():
        fluxo[int(row.ano)] = row.receita_liquida_arbitragem_rs_ano - row.custo_operacional_rs_ano
    soh_final = trajetoria.iloc[-1].soh_fim_ano
    fluxo[-1] += fin.valor_residual_pct_capex * fin.capex_total_rs * soh_final
    return fluxo


def calcular_vpl(fluxo: np.ndarray, taxa_desconto_real: float) -> float:
    """VPL genérico — funciona para qualquer fluxo de caixa (ao contrário de
    financial.py::calcular_vpl_detalhado, que é parametrizado por um BID
    constante — aqui a receita já varia ano a ano dentro do próprio `fluxo`)."""
    anos = np.arange(len(fluxo))
    return float(np.sum(fluxo / (1 + taxa_desconto_real) ** anos))
