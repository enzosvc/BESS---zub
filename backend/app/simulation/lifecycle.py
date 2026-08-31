"""
Laço de 15 anos: degradação (SOH/RTE), capacidade líquida no POI, e augmentation.

Portado do Bloco 7 do notebook, com UMA correção importante: a função original
referenciava `fin` como variável global (funcionava no notebook porque só existe
uma sessão por vez). Aqui `fin` é passado explicitamente como parâmetro, porque
o backend atende múltiplos usuários/simulações concorrentes — cada request tem
seu próprio `cfg`/`fin`, e não podem se misturar.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import ConfigBESSDetalhado, ConfigFinanceiraDetalhada
from .battery import calcular_fator_conversao, eficiencia_base_do_ano
from .annual import simular_ano_detalhado


def simular_15_anos(ordens: pd.DataFrame, cfg: ConfigBESSDetalhado,
                     fin: ConfigFinanceiraDetalhada, seed: int = 2026) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # A trajetória de SOH vem diretamente de cfg.soh_referencia_por_ano — a MESMA tabela
    # que já governa a eficiência. Augmentation soma capacidade nova por cima dessa curva
    # de referência sempre que ela (mais o que já foi somado antes) cruza o piso.
    capacidade_extra_acumulada = 0.0

    linhas = []
    for ano in range(1, cfg.prazo_anos + 1):
        disponibilidade_ano = np.interp(
            ano, [1, cfg.prazo_anos], [cfg.disponibilidade_ano1_pct, cfg.disponibilidade_ano15_pct]
        )

        # 6) SOH do ano: direto da tabela de referência (mesmo índice usado em eficiencia_base_do_ano).
        # Protegido com clip por defesa extra — a validação em validar_curvas_vs_prazo() já garante
        # que isso não deveria disparar, mas mantemos os dois pontos de leitura simétricos.
        indice_soh = min(ano, len(cfg.soh_referencia_por_ano) - 1)
        soh_referencia_ano = cfg.soh_referencia_por_ano[indice_soh]
        capacidade_disponivel = soh_referencia_ano * cfg.capacidade_nominal_mwh + capacidade_extra_acumulada
        soh_efetivo = capacidade_disponivel / cfg.capacidade_nominal_mwh

        # Capacidade LÍQUIDA no POI — quanto esse ano de fato consegue entregar num
        # descarregamento completo (SOC cheio -> SOC mínimo), já descontando a eficiência
        # do ano (Mean RTE) e toda a cadeia de perdas, e o consumo de auxiliares ao longo
        # da duração nominal (1/C-rate). É essa capacidade que deve ser comparada ao
        # compromisso — não a capacidade de placa da bateria.
        fator_conversao_ano = calcular_fator_conversao(cfg)
        eficiencia_ano = eficiencia_base_do_ano(ano, cfg)
        duracao_horas = 1 / cfg.c_rate
        capacidade_liquida_poi_mwh = (
            capacidade_disponivel * eficiencia_ano * fator_conversao_ano
            - cfg.consumo_auxiliares_mw * duracao_horas
        )

        resultado = simular_ano_detalhado(
            ordens, cfg, soh=soh_efetivo, capacidade_disponivel_mwh=capacidade_disponivel,
            disponibilidade_media_ano=disponibilidade_ano, ano=ano, rng=rng
        )

        # 8) Augmentation: dispara se a capacidade LÍQUIDA NO POI cair abaixo do compromisso
        evento_augmentation = capacidade_liquida_poi_mwh < cfg.disponibilidade_comprometida_mwh
        custo_augmentation_rs = 0.0
        incremento_mwh = 0.0
        if evento_augmentation:
            # Incremento dimensionado para fechar exatamente o gap entre a capacidade líquida
            # no POI e o compromisso contratual (mais a margem de segurança) — invertendo a
            # fórmula de capacidade_liquida_poi_mwh para achar o incremento mínimo de
            # capacidade de PLACA (antes de eficiência e perdas) que fecha esse gap.
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
            'deficit_mwh_ano': resultado['deficit_mwh_ano'],
            'deficit_descarga_mwh_ano': resultado['deficit_descarga_mwh_ano'],
            'deficit_carga_mwh_ano': resultado['deficit_carga_mwh_ano'],
            'evento_augmentation': evento_augmentation,
            'incremento_augmentation_mwh': incremento_mwh,
            'custo_augmentation_rs': custo_augmentation_rs,
        })

    return pd.DataFrame(linhas)
