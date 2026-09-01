"""
Funções técnicas do modelo detalhado — eficiência instantânea, potência máxima
por SOC, e a cadeia de perdas da bateria (CC) até o ponto de conexão (POI).

Portado 1:1 dos Blocos 4 e 5 do notebook.
"""
from __future__ import annotations

import numpy as np

from .config import ConfigBESSDetalhado


def calcular_fator_conversao(cfg: ConfigBESSDetalhado) -> float:
    """Cadeia: cabo DC-AC -> PCS -> cabo trafo média-alta -> trafo média ->
    cabo alta tensão -> trafo de alta -> POI."""
    return (
        (1 - cfg.perda_cabo_dc_ac_pct)
        * cfg.eficiencia_pcs
        * (1 - cfg.perda_cabo_trafo_media_alta_pct)
        * cfg.eficiencia_transformador_media_pct
        * (1 - cfg.perda_cabo_alta_tensao_pct)
        * cfg.eficiencia_transformador_alta_pct
    )


def eficiencia_base_do_ano(ano: int, cfg: ConfigBESSDetalhado) -> float:
    """Eficiência de uma única via (carga OU descarga) para o ano em questão,
    derivada do Round-Trip Efficiency médio daquele ano: eta = sqrt(RTE).
    ano=0 é o comissionamento (não usado no laço operacional); ano=1..15 são os
    anos do contrato."""
    indice = int(np.clip(ano, 0, len(cfg.mean_rte_por_ano) - 1))
    rte_medio_ano = cfg.mean_rte_por_ano[indice]
    return float(np.sqrt(rte_medio_ano))


def eficiencia_variavel(potencia_mw: float, potencia_nominal_mw: float, soc: float,
                         temperatura_c: float, eficiencia_base_ano: float,
                         cfg: ConfigBESSDetalhado) -> float:
    """Eficiência instantânea: parte da eficiência-base do ANO (vem do RTE médio,
    um efeito independente do SOH) e desconta apenas desvios instantâneos de
    potência, SOC e temperatura."""
    p_ratio = min(abs(potencia_mw) / potencia_nominal_mw, 1.0) if potencia_nominal_mw > 0 else 0.0
    ponto_medio_soc = (cfg.soc_min + cfg.soc_max) / 2
    meia_largura_soc = (cfg.soc_max - cfg.soc_min) / 2
    soc_dev = min(abs(soc - ponto_medio_soc) / meia_largura_soc, 1.0) if meia_largura_soc > 0 else 0.0
    temp_dev = min(abs(temperatura_c - cfg.temperatura_nominal_c) / 15.0, 1.0)

    penalidade_potencia = 0.030 * p_ratio ** 2
    penalidade_soc = 0.020 * soc_dev ** 2
    penalidade_temp = 0.015 * temp_dev ** 2

    eta = eficiencia_base_ano - penalidade_potencia - penalidade_soc - penalidade_temp
    return float(np.clip(eta, 0.70, 0.99))


def potencia_maxima_soc(soc: float, potencia_nominal_mw: float, sentido: str,
                         cfg: ConfigBESSDetalhado) -> float:
    """Degrau simples: potência nominal plena em qualquer SOC dentro da janela
    [soc_min, soc_max]; zero fora dela."""
    if sentido == 'descarga':
        return potencia_nominal_mw if soc > cfg.soc_min else 0.0
    else:  # carga
        return potencia_nominal_mw if soc < cfg.soc_max else 0.0
