"""
Conversão entre o formato de armazenamento de um cenário de preço
(`price_scenarios.precos_por_ano`, no Supabase — um dict {"1": [floats], ...})
e o formato que `engine_arbitragem.rodar_simulacao_arbitragem` espera
(`{1: DataFrame(data_hora, preco_rs_mwh), ...}`).

Por que a data é sintética: o motor de arbitragem só usa a data para (a)
agrupar em blocos de 24h e (b) achar a hora do dia — a data-calendário real
é irrelevante para a física ou para a estratégia de despacho. Por isso o
cenário salvo guarda só os NÚMEROS por ano simulado, e este módulo cria um
índice horário artificial (sempre a partir de 2000-01-01) só para satisfazer
o formato de DataFrame que `orders_arbitragem.criar_ordens_arbitragem` exige.
"""
from __future__ import annotations

from typing import Dict, List

import pandas as pd


class CenarioPrecoInvalido(ValueError):
    pass


def validar_lista_precos_ano(precos: List[float], ano_rotulo: str | int) -> None:
    if len(precos) == 0:
        raise CenarioPrecoInvalido(f"Ano {ano_rotulo}: lista de preços vazia.")
    if len(precos) % 24 != 0:
        raise CenarioPrecoInvalido(
            f"Ano {ano_rotulo}: {len(precos)} horas não é múltiplo de 24 "
            f"(precisa ser um número inteiro de dias completos)."
        )
    if len(precos) not in (8760, 8784):
        raise CenarioPrecoInvalido(
            f"Ano {ano_rotulo}: {len(precos)} horas — esperado 8760 (ano comum) "
            f"ou 8784 (ano bissexto)."
        )


def construir_precos_por_ano(precos_por_ano_raw: Dict[str, List[float]],
                              prazo_anos: int) -> Dict[int, pd.DataFrame]:
    """
    precos_por_ano_raw: como vem do banco — chaves string ("1", "2", ...),
    valores = lista de preços horários (8760 ou 8784 números).

    NÃO cicla mais o cenário para preencher `prazo_anos`. O horizonte efetivo
    da análise é `min(prazo_anos, anos disponíveis no cenário)` — se o cenário
    tiver menos anos que o prazo do contrato, a análise para no último ano com
    dado de preço real, em vez de repetir anos artificialmente. Quem decide o
    prazo_anos EFETIVO a partir do tamanho do dict retornado é
    `engine_arbitragem.rodar_simulacao_arbitragem` (ver `horizonte_efetivo_anos`
    no resultado da simulação).
    """
    if not precos_por_ano_raw:
        raise CenarioPrecoInvalido("Cenário de preço vazio — nenhum ano informado.")

    anos_ordenados = sorted(precos_por_ano_raw.keys(), key=lambda k: int(k))
    for chave in anos_ordenados:
        validar_lista_precos_ano(precos_por_ano_raw[chave], chave)

    anos_usados = anos_ordenados[:prazo_anos]  # trunca; nunca cicla

    resultado: Dict[int, pd.DataFrame] = {}
    for ano_simulado, chave_origem in enumerate(anos_usados, start=1):
        precos = precos_por_ano_raw[chave_origem]
        indice = pd.date_range('2000-01-01', periods=len(precos), freq='h')
        resultado[ano_simulado] = pd.DataFrame({
            'data_hora': indice,
            'preco_rs_mwh': precos,
        })

    return resultado


def resumo_cenario(precos_por_ano_raw: Dict[str, List[float]]) -> dict:
    """Estatísticas rápidas para mostrar ao usuário depois do upload (preview),
    sem precisar rodar uma simulação inteira."""
    anos_ordenados = sorted(precos_por_ano_raw.keys(), key=lambda k: int(k))
    resumo_por_ano = []
    for chave in anos_ordenados:
        precos = precos_por_ano_raw[chave]
        resumo_por_ano.append({
            'ano': int(chave),
            'n_horas': len(precos),
            'preco_medio_rs_mwh': sum(precos) / len(precos) if precos else 0.0,
            'preco_min_rs_mwh': min(precos) if precos else 0.0,
            'preco_max_rs_mwh': max(precos) if precos else 0.0,
        })
    return {'n_anos': len(anos_ordenados), 'anos': resumo_por_ano}
