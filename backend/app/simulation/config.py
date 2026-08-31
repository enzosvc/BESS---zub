"""
Configuração técnica e financeira do modelo de BESS.

Portado do notebook `BESS_Modelo_Detalhado`. As dataclasses abaixo são o
"contrato de dados" entre o formulário de input (frontend) e o motor de
simulação (este backend) — todo campo aqui deve ter um campo correspondente
no formulário do frontend (ver `frontend/lib/inputSchema.ts`).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Tuple


@dataclass(frozen=True)
class ConfigBESSDetalhado:
    # --- dimensionamento e C-rate ---
    capacidade_nominal_mwh: float
    c_rate: float
    potencia_nominal_efetiva_mw: float  # derivado: capacidade_nominal_mwh * c_rate

    # --- janela operacional de SOC ---
    soc_inicial: float
    soc_min: float
    soc_max: float

    # --- resolução temporal e prazo ---
    delta_t_h: float
    dias_simulados_por_ano: int
    prazo_anos: int

    # --- eficiência: RTE médio por ano (independente do SOH) e SOH de referência ---
    # índice 0 = comissionamento (ano 0*); índices 1..15 = médias de cada ano do contrato
    mean_rte_por_ano: Tuple[float, ...]
    soh_referencia_por_ano: Tuple[float, ...]

    # --- temperatura ---
    temperatura_nominal_c: float
    temperatura_media_c: float
    temperatura_desvio_padrao_c: float

    # --- cadeia de perdas, bateria (CC) até o POI ---
    perda_cabo_dc_ac_pct: float
    eficiencia_pcs: float
    eficiencia_transformador_media_pct: float
    perda_cabo_trafo_media_alta_pct: float
    perda_cabo_alta_tensao_pct: float
    consumo_auxiliares_mw: float

    # --- disponibilidade ---
    disponibilidade_ano1_pct: float
    disponibilidade_ano15_pct: float
    fator_potencia_derating: float

    # --- augmentation ---
    disponibilidade_comprometida_mwh: float
    margem_seguranca_augmentation: float
    reducao_custo_modulo_aa: float

    # --- perfil de ordens sintéticas ---
    carga_janela1_inicio_h: float
    carga_janela1_fim_h: float
    carga_janela2_inicio_h: float
    carga_janela2_fim_h: float
    descarga_janela1_inicio_h: float
    descarga_janela1_fim_h: float
    descarga_janela2_inicio_h: float
    descarga_janela2_fim_h: float
    fracao_minima_ciclo_secundario: float
    probabilidade_ciclo_secundario: float


@dataclass(frozen=True)
class ConfigFinanceiraDetalhada:
    capex_total_rs: float
    opex_fixo_pct_capex: float
    custo_variavel_rs_mwh: float
    preco_energia_perdas_rs_mwh: float
    capacidade_nominal_mwh: float
    custo_augmentation_rs_mwh: float
    custo_nao_atendimento_rs_mwh: float
    tarifa_tust_c_rs_kw_mes: float
    tarifa_tust_g_rs_kw_mes: float
    taxa_desconto_real: float
    prazo_anos: int
    valor_residual_pct_capex: float

    # Placeholders — preenchidos via dataclasses.replace() DEPOIS que a trajetória de
    # 15 anos existe, porque dependem da maior capacidade líquida no POI ao longo da
    # vida do projeto (ver simulation/financial.py::calcular_opex_fixo_capex).
    potencia_referencia_tust_mw: float = 0.0
    opex_fixo_capex_rs_ano: float = 0.0


def validar_curvas_vs_prazo(cfg: ConfigBESSDetalhado) -> None:
    """As curvas mean_rte_por_ano e soh_referencia_por_ano são indexadas por
    `ano` (1..prazo_anos), com o índice 0 reservado pro comissionamento — ou
    seja, cada uma precisa ter pelo menos `prazo_anos + 1` elementos.

    Ter MAIS elementos que o necessário não é problema (os extras ficam sem
    uso, se você reduzir o prazo). Ter MENOS é: sem essa validação, o acesso
    ao índice fora do array ou quebra com IndexError, ou (dependendo de onde
    é lido) reusa silenciosamente o último valor da curva pros anos que
    faltam — o que dá um resultado financeiro enganoso sem avisar ninguém.
    Por isso validamos aqui, na entrada, com uma mensagem explícita.
    """
    minimo_necessario = cfg.prazo_anos + 1

    if len(cfg.mean_rte_por_ano) < minimo_necessario:
        raise ValueError(
            f"mean_rte_por_ano tem {len(cfg.mean_rte_por_ano)} elementos, mas o prazo de "
            f"{cfg.prazo_anos} anos precisa de pelo menos {minimo_necessario} "
            f"(índice 0 = comissionamento + 1 valor por ano do contrato)."
        )
    if len(cfg.soh_referencia_por_ano) < minimo_necessario:
        raise ValueError(
            f"soh_referencia_por_ano tem {len(cfg.soh_referencia_por_ano)} elementos, mas o prazo de "
            f"{cfg.prazo_anos} anos precisa de pelo menos {minimo_necessario} "
            f"(índice 0 = comissionamento + 1 valor por ano do contrato)."
        )


def construir_config_default() -> tuple[ConfigBESSDetalhado, ConfigFinanceiraDetalhada]:
    """Valores-padrão (os mesmos do notebook), usados só para testes locais.
    Em produção, cfg/fin vêm sempre do payload de input do usuário."""

    capacidade_nominal_mwh = 240.681
    c_rate = 0.25

    cfg = ConfigBESSDetalhado(
        capacidade_nominal_mwh=capacidade_nominal_mwh,
        c_rate=c_rate,
        potencia_nominal_efetiva_mw=capacidade_nominal_mwh * c_rate,
        soc_inicial=0.50,
        soc_min=0.0,
        soc_max=1.0,
        delta_t_h=0.25,
        dias_simulados_por_ano=30,
        prazo_anos=15,
        mean_rte_por_ano=(
            0.9510, 0.9448, 0.9419, 0.9396, 0.9377, 0.9359, 0.9343, 0.9329,
            0.9322, 0.9315, 0.9309, 0.9303, 0.9297, 0.9291, 0.9286, 0.9281,
        ),
        soh_referencia_por_ano=(
            1.0000, 1.0000, 0.9792, 0.9586, 0.9402, 0.9232, 0.9074, 0.8925,
            0.8783, 0.8647, 0.8516, 0.8390, 0.8268, 0.8149, 0.8034, 0.7921,
        ),
        temperatura_nominal_c=25.0,
        temperatura_media_c=25.0,
        temperatura_desvio_padrao_c=6.0,
        perda_cabo_dc_ac_pct=0.006,
        eficiencia_pcs=0.985,
        eficiencia_transformador_media_pct=0.992,
        perda_cabo_trafo_media_alta_pct=0.0,
        perda_cabo_alta_tensao_pct=0.025,
        consumo_auxiliares_mw=0.49448,
        disponibilidade_ano1_pct=0.98,
        disponibilidade_ano15_pct=0.96,
        fator_potencia_derating=0.50,
        disponibilidade_comprometida_mwh=200.0,
        margem_seguranca_augmentation=0.05,
        reducao_custo_modulo_aa=0.00,
        carga_janela1_inicio_h=23.0,
        carga_janela1_fim_h=5.0,
        carga_janela2_inicio_h=10.0,
        carga_janela2_fim_h=16.0,
        descarga_janela1_inicio_h=5.0,
        descarga_janela1_fim_h=9.0,
        descarga_janela2_inicio_h=16.0,
        descarga_janela2_fim_h=22.0,
        fracao_minima_ciclo_secundario=0.60,
        probabilidade_ciclo_secundario=0.35,
    )

    capex_total_rs = 6280 * 50 * 1000 / 1.25

    fin = ConfigFinanceiraDetalhada(
        capex_total_rs=capex_total_rs,
        opex_fixo_pct_capex=0.02,
        custo_variavel_rs_mwh=0.0,
        preco_energia_perdas_rs_mwh=0.0,
        capacidade_nominal_mwh=capacidade_nominal_mwh,
        custo_augmentation_rs_mwh=(capex_total_rs / capacidade_nominal_mwh) * 0.9,
        custo_nao_atendimento_rs_mwh=400.0,
        tarifa_tust_c_rs_kw_mes=0.0,
        tarifa_tust_g_rs_kw_mes=10.0,
        taxa_desconto_real=0.10,
        prazo_anos=15,
        valor_residual_pct_capex=0.00,
    )

    return cfg, fin
