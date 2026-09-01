"""
Schemas Pydantic — o "contrato" da API. Todo campo em `ConfigBESSInput` e
`ConfigFinanceiraInput` corresponde 1:1 a um campo de `ConfigBESSDetalhado` /
`ConfigFinanceiraDetalhada` (ver simulation/config.py) — exceto os placeholders
calculados internamente (potencia_referencia_tust_mw, opex_fixo_capex_rs_ano),
que não fazem parte do input do usuário.
"""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class ConfigBESSInput(BaseModel):
    # --- dimensionamento e C-rate ---
    capacidade_nominal_mwh: float = Field(240.681, gt=0, description="Capacidade nominal do sistema, em MWh")
    c_rate: float = Field(0.25, gt=0, le=4, description="C-rate da bateria (1/C-rate = duração nominal em horas)")

    # --- janela operacional de SOC ---
    soc_inicial: float = Field(0.50, ge=0, le=1)
    soc_min: float = Field(0.0, ge=0, le=1)
    soc_max: float = Field(1.0, ge=0, le=1)

    # --- resolução temporal e prazo ---
    delta_t_h: float = Field(0.25, gt=0, description="Passo de tempo da simulação, em horas")
    dias_simulados_por_ano: int = Field(30, gt=0, le=365, description="Mês representativo, extrapolado para o ano")
    prazo_anos: int = Field(15, gt=0, le=30)

    # --- eficiência: RTE médio por ano e SOH de referência ---
    # índice 0 = comissionamento; índices 1..prazo_anos = médias de cada ano do contrato
    mean_rte_por_ano: List[float] = Field(
        default=[0.9510, 0.9448, 0.9419, 0.9396, 0.9377, 0.9359, 0.9343, 0.9329,
                  0.9322, 0.9315, 0.9309, 0.9303, 0.9297, 0.9291, 0.9286, 0.9281],
        description="RTE médio por ano (fração 0-1), índice 0 = comissionamento",
    )
    soh_referencia_por_ano: List[float] = Field(
        default=[1.0000, 1.0000, 0.9792, 0.9586, 0.9402, 0.9232, 0.9074, 0.8925,
                  0.8783, 0.8647, 0.8516, 0.8390, 0.8268, 0.8149, 0.8034, 0.7921],
        description="SOH de referência por ano (fração 0-1), índice 0 = comissionamento",
    )

    # --- temperatura ---
    temperatura_nominal_c: float = 25.0
    temperatura_media_c: float = 25.0
    temperatura_desvio_padrao_c: float = Field(6.0, ge=0)

    # --- cadeia de perdas, bateria (CC) até o POI ---
    perda_cabo_dc_ac_pct: float = Field(0.006, ge=0, le=1)
    eficiencia_pcs: float = Field(0.985, gt=0, le=1)
    eficiencia_transformador_media_pct: float = Field(0.992, gt=0, le=1)
    perda_cabo_trafo_media_alta_pct: float = Field(0.0, ge=0, le=1)
    perda_cabo_alta_tensao_pct: float = Field(0.025, ge=0, le=1)
    eficiencia_transformador_alta_pct: float = Field(0.99, gt=0, le=1)
    consumo_auxiliares_mw: float = Field(0.49448, ge=0)

    # --- disponibilidade ---
    disponibilidade_ano1_pct: float = Field(0.98, ge=0, le=1)
    disponibilidade_ano15_pct: float = Field(0.96, ge=0, le=1)
    fator_potencia_derating: float = Field(0.50, ge=0, le=1)

    # --- augmentation ---
    disponibilidade_comprometida_mwh: float = Field(200.0, gt=0)
    margem_seguranca_augmentation: float = Field(0.05, ge=0)
    reducao_custo_modulo_aa: float = Field(0.00, ge=0, lt=1)

    # --- perfil de ordens sintéticas ---
    carga_janela1_inicio_h: float = Field(23.0, ge=0, lt=24)
    carga_janela1_fim_h: float = Field(5.0, ge=0, lt=24)
    carga_janela2_inicio_h: float = Field(10.0, ge=0, lt=24)
    carga_janela2_fim_h: float = Field(16.0, ge=0, lt=24)
    descarga_janela1_inicio_h: float = Field(5.0, ge=0, lt=24)
    descarga_janela1_fim_h: float = Field(9.0, ge=0, lt=24)
    descarga_janela2_inicio_h: float = Field(16.0, ge=0, lt=24)
    descarga_janela2_fim_h: float = Field(22.0, ge=0, lt=24)
    fracao_minima_ciclo_secundario: float = Field(0.60, ge=0, le=1)
    probabilidade_ciclo_secundario: float = Field(0.35, ge=0, le=1)

    @field_validator("mean_rte_por_ano", "soh_referencia_por_ano")
    @classmethod
    def valida_tamanho_curva(cls, v, info):
        if len(v) < 2:
            raise ValueError(f"{info.field_name} precisa ter pelo menos 2 valores (índice 0 + ano 1)")
        return v


class ConfigFinanceiraInput(BaseModel):
    capex_total_rs: float = Field(..., gt=0, description="CAPEX total do projeto, em R$")
    opex_fixo_pct_capex: float = Field(0.02, ge=0, le=1)
    custo_variavel_rs_mwh: float = Field(0.0, ge=0)
    preco_energia_perdas_rs_mwh: float = Field(0.0, ge=0)
    custo_augmentation_rs_mwh: float = Field(..., gt=0, description="Custo de repor 1 MWh de capacidade, R$/MWh")
    custo_nao_atendimento_rs_mwh: float = Field(400.0, ge=0)
    tarifa_tust_c_rs_kw_mes: float = Field(0.0, ge=0, description="R$/kW.mês")
    tarifa_tust_g_rs_kw_mes: float = Field(10.0, ge=0, description="R$/kW.mês")
    taxa_desconto_real: float = Field(0.10, gt=-1, description="WACC real")
    valor_residual_pct_capex: float = Field(0.00, ge=0, le=1)


class SimulacaoInput(BaseModel):
    nome: Optional[str] = Field(None, description="Nome do projeto/cenário, para salvar")
    seed: int = Field(2026, description="Semente aleatória (reprodutibilidade)")
    bess: ConfigBESSInput
    financeiro: ConfigFinanceiraInput


class SimulacaoResultado(BaseModel):
    """Espelha o dict devolvido por `engine.rodar_simulacao_completa` — ver lá
    para a estrutura exata de cada campo (mantido como dict solto/`Any` aqui
    de propósito, para não duplicar toda a modelagem de novo)."""
    entrada: dict
    perfil_ordens: dict
    trajetoria_15_anos: list
    detalhamento_custos: list
    fluxo_caixa_rs: list
    resultado_financeiro: dict


class SensibilidadeJobStatus(BaseModel):
    job_id: str
    status: str  # 'pending' | 'running' | 'completed' | 'failed'
    progresso_feito: int = 0
    progresso_total: int = 0
    resultado: Optional[list] = None
    erro: Optional[str] = None
