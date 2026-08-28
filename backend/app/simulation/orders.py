"""
Geração do perfil sintético de ordens (carga determinística + descarga aleatória).

Portado 1:1 do Bloco 3 do notebook. Ver o notebook para a explicação de negócio
completa: ciclo PRINCIPAL (janela 2) acontece todo dia e sempre entrega 100% da
capacidade comprometida; ciclo SECUNDÁRIO (janela 1) acontece numa fração dos
dias, com potência sorteada Uniform(fracao_minima, 100%) do teto contratual.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import ConfigBESSDetalhado


def criar_ordens_sinteticas(cfg: ConfigBESSDetalhado, seed: int = 2026) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    n = int((cfg.dias_simulados_por_ano * 24) / cfg.delta_t_h)
    indice = pd.date_range('2026-01-01', periods=n, freq='15min')
    ordem = np.zeros(n)
    tipo = np.full(n, 'espera', dtype=object)
    ciclo_id = np.zeros(n, dtype=int)

    dias_unicos = sorted(set(indice.date))
    n_dias_periodo = len(dias_unicos)

    potencia_cap_mw = cfg.disponibilidade_comprometida_mwh * cfg.c_rate
    duracao_nominal_h = 1 / cfg.c_rate  # 4h: tempo pleno de carga/descarga a C-rate nominal

    # distribuição determinística do ciclo SECUNDÁRIO (janela 1): acontece numa fração fixa
    # dos dias, espalhada uniformemente pelo período — não sorteada dia a dia
    n_dias_com_ciclo_secundario = round(cfg.probabilidade_ciclo_secundario * n_dias_periodo)
    if n_dias_com_ciclo_secundario > 0:
        indices_dias_com_ciclo_secundario = set(
            np.linspace(0, n_dias_periodo - 1, n_dias_com_ciclo_secundario, dtype=int)
        )
    else:
        indices_dias_com_ciclo_secundario = set()

    for idx_dia, dia in enumerate(dias_unicos):
        ts_dia = pd.Timestamp(dia)

        # --- ciclo PRINCIPAL: sempre acontece, sempre completo (100% de Y, potência plena) ---
        mask_carga_principal = (
            (indice >= ts_dia + pd.Timedelta(hours=cfg.carga_janela2_inicio_h))
            & (indice < ts_dia + pd.Timedelta(hours=cfg.carga_janela2_fim_h))
        )
        ordem[mask_carga_principal] = -cfg.potencia_nominal_efetiva_mw
        tipo[mask_carga_principal] = 'carga_principal'
        ciclo_id[mask_carga_principal] = 1

        inicio_descarga_principal = ts_dia + pd.Timedelta(hours=cfg.descarga_janela2_inicio_h)
        fim_descarga_principal = inicio_descarga_principal + pd.Timedelta(hours=duracao_nominal_h)
        mask_descarga_principal = (indice >= inicio_descarga_principal) & (indice < fim_descarga_principal)
        ordem[mask_descarga_principal] = potencia_cap_mw
        tipo[mask_descarga_principal] = 'descarga_principal'
        ciclo_id[mask_descarga_principal] = 1

        # --- ciclo SECUNDÁRIO: só em alguns dias, potência Uniform(fracao_minima, 100%) ---
        if idx_dia in indices_dias_com_ciclo_secundario:
            mask_carga_secundario = (
                (indice >= ts_dia + pd.Timedelta(hours=cfg.carga_janela1_inicio_h - 24))
                & (indice < ts_dia + pd.Timedelta(hours=cfg.carga_janela1_fim_h))
            )
            ordem[mask_carga_secundario] = -cfg.potencia_nominal_efetiva_mw
            tipo[mask_carga_secundario] = 'carga_secundario'
            ciclo_id[mask_carga_secundario] = 2

            potencia_secundaria_mw = rng.uniform(cfg.fracao_minima_ciclo_secundario, 1.0) * potencia_cap_mw
            mask_descarga_secundario = (
                (indice >= ts_dia + pd.Timedelta(hours=cfg.descarga_janela1_inicio_h))
                & (indice < ts_dia + pd.Timedelta(hours=cfg.descarga_janela1_fim_h))
            )
            ordem[mask_descarga_secundario] = potencia_secundaria_mw
            tipo[mask_descarga_secundario] = 'descarga_secundario'
            ciclo_id[mask_descarga_secundario] = 2

    df = pd.DataFrame({
        'data_hora': indice,
        'dia': indice.date,
        'hora': indice.hour + indice.minute / 60,
        'dia_semana': indice.day_name(),
        'fim_de_semana': indice.dayofweek >= 5,
        'potencia_solicitada_mw': ordem,
        'tipo_evento': tipo,
        'ciclo_id': ciclo_id,
    })
    n_ciclos_total = n_dias_periodo + len(indices_dias_com_ciclo_secundario)
    df.attrs['n_ciclos_periodo'] = n_ciclos_total
    df.attrs['n_dias_periodo'] = n_dias_periodo
    return df
