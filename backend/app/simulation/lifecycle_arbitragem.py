"""
Laço de 15 anos do modelo de ARBITRAGEM — espelha `lifecycle.py` (mesma
física de degradação/SOH/augmentation), mas com duas diferenças estruturais:

  1. O perfil de ordens MUDA a cada ano (vem do cenário de preço daquele ano
     calendário), em vez de reaproveitar o mesmo perfil de ~30 dias 15 vezes.
  2. A receita não é um BID contratado — é calculada ano a ano a partir do
     despacho real x preço real (ver financial_arbitragem.py).

O gatilho de augmentation aqui usa `cfg.disponibilidade_comprometida_mwh`
com um significado ligeiramente diferente do LRCAP: não é mais "compromisso
contratual com penalidade", e sim "capacidade mínima que o projeto precisa
manter para a estratégia de arbitragem continuar valendo o CAPEX de
reposição" — um parâmetro de decisão do usuário, não uma obrigação externa.
"""
from __future__ import annotations

from typing import Dict

import numpy as np
import pandas as pd

from .config import ConfigBESSDetalhado
from .battery import calcular_fator_conversao, eficiencia_base_do_ano
from .annual import simular_ano_detalhado
from .financial_arbitragem import ConfigFinanceiraArbitragem, calcular_receita_liquida_ano


def simular_15_anos_arbitragem(ordens_por_ano: Dict[int, pd.DataFrame],
                                cfg: ConfigBESSDetalhado,
                                fin: ConfigFinanceiraArbitragem,
                                seed: int = 2026) -> pd.DataFrame:
    """
    ordens_por_ano: dict {1: ordens_ano_1, 2: ordens_ano_2, ..., prazo_anos: ordens_ano_N},
    cada valor sendo o DataFrame retornado por `orders_arbitragem.criar_ordens_arbitragem`
    para o ano calendário correspondente do cenário de preço carregado pelo usuário.

    Pressupõe cfg.dias_simulados_por_ano == 365 (ver criar_ordens_arbitragem) — anos
    bissextos introduzem um viés de ~0,27% na extrapolação interna de
    `simular_ano_detalhado` (365/366), aceito como simplificação de screening.
    """
    rng = np.random.default_rng(seed)

    if set(ordens_por_ano.keys()) != set(range(1, cfg.prazo_anos + 1)):
        raise ValueError(
            f"ordens_por_ano precisa ter exatamente as chaves 1..{cfg.prazo_anos} "
            f"(uma por ano do prazo do projeto); recebido: {sorted(ordens_por_ano.keys())}."
        )

    capacidade_extra_acumulada = 0.0
    linhas = []

    for ano in range(1, cfg.prazo_anos + 1):
        ordens_ano = ordens_por_ano[ano]

        disponibilidade_ano = np.interp(
            ano, [1, cfg.prazo_anos], [cfg.disponibilidade_ano1_pct, cfg.disponibilidade_ano15_pct]
        )

        indice_soh = min(ano, len(cfg.soh_referencia_por_ano) - 1)
        soh_referencia_ano = cfg.soh_referencia_por_ano[indice_soh]
        capacidade_disponivel = soh_referencia_ano * cfg.capacidade_nominal_mwh + capacidade_extra_acumulada
        soh_efetivo = capacidade_disponivel / cfg.capacidade_nominal_mwh

        fator_conversao_ano = calcular_fator_conversao(cfg)
        eficiencia_ano = eficiencia_base_do_ano(ano, cfg)
        duracao_horas = 1 / cfg.c_rate
        capacidade_liquida_poi_mwh = (
            capacidade_disponivel * eficiencia_ano * fator_conversao_ano
            - cfg.consumo_auxiliares_mw * duracao_horas
        )

        resultado = simular_ano_detalhado(
            ordens_ano, cfg, soh=soh_efetivo, capacidade_disponivel_mwh=capacidade_disponivel,
            disponibilidade_media_ano=disponibilidade_ano, ano=ano, rng=rng
        )

        # augmentation: mesmo mecanismo do LRCAP, ver docstring do módulo para a
        # diferença de interpretação de `disponibilidade_comprometida_mwh`
        evento_augmentation = capacidade_liquida_poi_mwh < cfg.disponibilidade_comprometida_mwh
        custo_augmentation_rs = 0.0
        incremento_mwh = 0.0
        if evento_augmentation:
            alvo_capacidade_liquida = cfg.disponibilidade_comprometida_mwh * (1 + cfg.margem_seguranca_augmentation)
            capacidade_liquida_faltante = alvo_capacidade_liquida - capacidade_liquida_poi_mwh
            incremento_mwh = max(capacidade_liquida_faltante / (eficiencia_ano * fator_conversao_ano), 0.0)

            preco_modulo_rs_mwh = fin.custo_augmentation_rs_mwh * (1 - cfg.reducao_custo_modulo_aa) ** (ano - 1)
            custo_augmentation_rs = incremento_mwh * preco_modulo_rs_mwh
            capacidade_extra_acumulada += incremento_mwh
            capacidade_disponivel += incremento_mwh
            soh_efetivo = capacidade_disponivel / cfg.capacidade_nominal_mwh
            capacidade_liquida_poi_mwh = (
                capacidade_disponivel * eficiencia_ano * fator_conversao_ano
                - cfg.consumo_auxiliares_mw * duracao_horas
            )

        receita = calcular_receita_liquida_ano(
            ordens_ano, resultado['pot_poi_entregue_mw_serie'], fv_acoplado=fin.fv_acoplado
        )

        linhas.append({
            'ano': ano,
            'soh_referencia_ano': soh_referencia_ano,
            'soh_fim_ano': soh_efetivo,
            'capacidade_disponivel_mwh': capacidade_disponivel,
            'capacidade_liquida_poi_mwh': capacidade_liquida_poi_mwh,
            'disponibilidade_media_ano_pct': 100 * disponibilidade_ano,
            'disponibilidade_realizada_pct': 100 * resultado['disponibilidade_media_realizada'],
            'energia_liquida_poi_mwh_ano': resultado['energia_liquida_poi_mwh_ano'],
            'perdas_mwh_ano': resultado['perdas_mwh_ano'],
            'efc_ano': resultado['efc_ano'],
            'evento_augmentation': evento_augmentation,
            'incremento_augmentation_mwh': incremento_mwh,
            'custo_augmentation_rs': custo_augmentation_rs,
            **receita,
        })

    return pd.DataFrame(linhas)
