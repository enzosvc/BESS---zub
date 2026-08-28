"""
Simulação de um ano de operação, passo a passo de 15 minutos.

Portado 1:1 do Bloco 6 do notebook. Esta função roda o mês representativo
(cfg.dias_simulados_por_ano dias) sob um determinado estado do ativo (SOH,
capacidade disponível, disponibilidade média do ano) e retorna as métricas
anuais, já extrapoladas de N dias para 365.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import ConfigBESSDetalhado
from .battery import calcular_fator_conversao, eficiencia_base_do_ano, eficiencia_variavel, potencia_maxima_soc


def simular_ano_detalhado(ordens: pd.DataFrame, cfg: ConfigBESSDetalhado,
                           soh: float, capacidade_disponivel_mwh: float,
                           disponibilidade_media_ano: float, ano: int,
                           rng: np.random.Generator) -> dict:

    dias_unicos = np.array(sorted(ordens.dia.unique()))
    n_dias = len(dias_unicos)

    # --- 2) Disponibilidade: um estado por dia (disponível / derating / manutenção / indisponível) ---
    p_indisp = np.clip((1 - disponibilidade_media_ano) * 0.40, 0, 1)
    p_manut = np.clip((1 - disponibilidade_media_ano) * 0.30, 0, 1)
    p_derate = np.clip((1 - disponibilidade_media_ano) * 0.30, 0, 1)
    p_disp = max(1 - p_indisp - p_manut - p_derate, 0)
    probs = np.array([p_disp, p_derate, p_manut, p_indisp])
    probs = probs / probs.sum()
    estados = rng.choice(['disponivel', 'derating', 'manutencao', 'indisponivel'], size=n_dias, p=probs)
    fator_estado = {'disponivel': 1.0, 'derating': cfg.fator_potencia_derating, 'manutencao': 0.0, 'indisponivel': 0.0}
    fator_disp_por_dia = pd.Series({d: fator_estado[e] for d, e in zip(dias_unicos, estados)})

    # temperatura sintética diária
    temp_por_dia = pd.Series(
        rng.normal(cfg.temperatura_media_c, cfg.temperatura_desvio_padrao_c, n_dias),
        index=dias_unicos
    ).clip(-5, 45)

    fator_conversao = calcular_fator_conversao(cfg)

    # eficiência-base do ano: vem do RTE médio fornecido (efeito independente do SOH — a
    # capacidade já reduzida pelo SOH chega aqui via capacidade_disponivel_mwh, e o RTE reduz
    # por cima disso quanto dela vira energia líquida)
    eficiencia_base_ano = eficiencia_base_do_ano(ano, cfg)

    e_min = cfg.soc_min * capacidade_disponivel_mwh
    e_max = cfg.soc_max * capacidade_disponivel_mwh
    e_t = cfg.soc_inicial * capacidade_disponivel_mwh

    potencia_nominal_carga = cfg.potencia_nominal_efetiva_mw * soh
    potencia_nominal_descarga = cfg.potencia_nominal_efetiva_mw * soh

    n = len(ordens)
    soc_serie = np.zeros(n)
    pot_poi_entregue = np.zeros(n)
    perdas_totais_mwh = np.zeros(n)
    throughput_bateria_mwh = np.zeros(n)   # |energia| do lado da bateria, para EFC

    dias_arr = ordens.dia.values
    ordem_arr = ordens.potencia_solicitada_mw.values

    for i in range(n):
        dia = dias_arr[i]
        fator_disp = fator_disp_por_dia.loc[dia]
        temp = temp_por_dia.loc[dia]
        ordem_mw = ordem_arr[i]
        soc_atual = e_t / capacidade_disponivel_mwh

        if ordem_mw > 0:
            # 1) ordem de descarga no POI  ->  3) potência tecnicamente possível
            pot_bateria_alvo = (ordem_mw + cfg.consumo_auxiliares_mw) / fator_conversao
            pmax_soc = potencia_maxima_soc(soc_atual, potencia_nominal_descarga, 'descarga', cfg) * fator_disp

            eta = eficiencia_variavel(pot_bateria_alvo, potencia_nominal_descarga, soc_atual, temp, eficiencia_base_ano, cfg)
            pmax_energia = max((e_t - e_min) * eta / cfg.delta_t_h, 0.0)

            pot_bateria = max(min(pot_bateria_alvo, pmax_soc, pmax_energia), 0.0)
            eta = eficiencia_variavel(pot_bateria, potencia_nominal_descarga, soc_atual, temp, eficiencia_base_ano, cfg)

            energia_retirada = pot_bateria * cfg.delta_t_h / eta
            perda_bateria = energia_retirada - pot_bateria * cfg.delta_t_h
            e_prox = e_t - energia_retirada

            pot_poi = max(pot_bateria * fator_conversao - cfg.consumo_auxiliares_mw, 0.0)
            perda_conversao = pot_bateria - pot_poi
            throughput = pot_bateria * cfg.delta_t_h

        elif ordem_mw < 0:
            # 1) ordem de carga no POI  ->  3) potência tecnicamente possível
            pot_bateria_alvo = max(abs(ordem_mw) - cfg.consumo_auxiliares_mw, 0.0) * fator_conversao
            pmax_soc = potencia_maxima_soc(soc_atual, potencia_nominal_carga, 'carga', cfg) * fator_disp

            eta = eficiencia_variavel(pot_bateria_alvo, potencia_nominal_carga, soc_atual, temp, eficiencia_base_ano, cfg)
            pmax_energia = max((e_max - e_t) / (eta * cfg.delta_t_h), 0.0)

            pot_bateria = max(min(pot_bateria_alvo, pmax_soc, pmax_energia), 0.0)
            eta = eficiencia_variavel(pot_bateria, potencia_nominal_carga, soc_atual, temp, eficiencia_base_ano, cfg)

            energia_entra = eta * pot_bateria * cfg.delta_t_h
            perda_bateria = pot_bateria * cfg.delta_t_h - energia_entra
            e_prox = e_t + energia_entra

            pot_poi = -(pot_bateria / fator_conversao + cfg.consumo_auxiliares_mw)
            perda_conversao = abs(pot_poi) - pot_bateria
            throughput = pot_bateria * cfg.delta_t_h

        else:
            e_prox = e_t
            pot_poi = 0.0
            perda_bateria = 0.0
            perda_conversao = 0.0
            throughput = 0.0

        e_prox = min(max(e_prox, e_min), e_max)
        e_t = e_prox

        soc_serie[i] = e_t / capacidade_disponivel_mwh
        pot_poi_entregue[i] = pot_poi
        perdas_totais_mwh[i] = perda_bateria + max(perda_conversao, 0.0)
        throughput_bateria_mwh[i] = throughput

    fator_anualizacao = 365 / cfg.dias_simulados_por_ano

    energia_liquida_poi_mwh = np.sum(np.where(pot_poi_entregue > 0, pot_poi_entregue, 0)) * cfg.delta_t_h
    energia_absorvida_poi_mwh = -np.sum(np.where(pot_poi_entregue < 0, pot_poi_entregue, 0)) * cfg.delta_t_h
    perdas_mwh = perdas_totais_mwh.sum()
    throughput_total_mwh = throughput_bateria_mwh.sum()
    efc = throughput_total_mwh / (2 * cfg.capacidade_nominal_mwh)

    # Déficit separado por sentido. Bateria cheia recusando carga NÃO é uma falha de
    # atendimento (é folga/capacidade ociosa, sem custo real) — só o déficit de DESCARGA
    # representa um compromisso de capacidade não cumprido no POI, e é só esse que deve
    # entrar na penalidade financeira de não atendimento.
    mask_descarga = ordem_arr > 0
    mask_carga = ordem_arr < 0
    deficit_descarga_mwh = np.sum(np.maximum(ordem_arr[mask_descarga] - pot_poi_entregue[mask_descarga], 0)) * cfg.delta_t_h
    deficit_carga_mwh = np.sum(np.maximum(np.abs(ordem_arr[mask_carga]) - np.abs(pot_poi_entregue[mask_carga]), 0)) * cfg.delta_t_h
    deficit_mwh = deficit_descarga_mwh + deficit_carga_mwh

    return {
        'ano': ano,
        'energia_liquida_poi_mwh_ano': energia_liquida_poi_mwh * fator_anualizacao,
        'energia_absorvida_poi_mwh_ano': energia_absorvida_poi_mwh * fator_anualizacao,
        'perdas_mwh_ano': perdas_mwh * fator_anualizacao,
        'efc_ano': efc * fator_anualizacao,
        'deficit_mwh_ano': deficit_mwh * fator_anualizacao,
        'deficit_descarga_mwh_ano': deficit_descarga_mwh * fator_anualizacao,
        'deficit_carga_mwh_ano': deficit_carga_mwh * fator_anualizacao,
        'soc_serie_amostra': soc_serie.tolist(),
        'disponibilidade_media_realizada': float(fator_disp_por_dia.mean()),
    }
