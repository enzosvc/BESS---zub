"""
Conversão entre o formato de armazenamento de um UGC
(`ugc_scenarios.geracao_por_ano`, no Supabase — um dict {"1": [floats], ...})
e o formato que o motor Colocalizado espera (`{1: DataFrame(data_hora,
geracao_mw), ...}`). Espelha price_scenario.py — mesma mecânica, mesma regra
de primeiro/último ano parcial — só o conteúdo semântico muda (MW gerado
pela usina, não R$/MWh).
"""
from __future__ import annotations

from typing import Dict, List

import pandas as pd


class UGCInvalido(ValueError):
    pass


def validar_lista_geracao_ano(geracao: List[float], ano_rotulo: str | int, permitir_parcial: bool = False) -> None:
    if len(geracao) == 0:
        raise UGCInvalido(f"Ano {ano_rotulo}: lista de geração vazia.")
    if len(geracao) % 24 != 0:
        raise UGCInvalido(
            f"Ano {ano_rotulo}: {len(geracao)} horas não é múltiplo de 24 "
            f"(precisa ser um número inteiro de dias completos)."
        )
    if not permitir_parcial and len(geracao) not in (8760, 8784):
        raise UGCInvalido(
            f"Ano {ano_rotulo}: {len(geracao)} horas — esperado 8760 (ano comum) "
            f"ou 8784 (ano bissexto). Só o primeiro/último ano do UGC pode ser parcial."
        )


def construir_geracao_por_ano(geracao_por_ano_raw: Dict[str, List[float]],
                               prazo_anos: int) -> Dict[int, pd.DataFrame]:
    """
    Mesma lógica de price_scenario.construir_precos_por_ano: não cicla (trunca
    em min(prazo_anos, anos disponíveis)), primeiro/último ano podem ser
    parciais, meio precisa ser completo.
    """
    if not geracao_por_ano_raw:
        raise UGCInvalido("UGC vazio — nenhum ano informado.")

    anos_ordenados = sorted(geracao_por_ano_raw.keys(), key=lambda k: int(k))
    n = len(anos_ordenados)
    for indice, chave in enumerate(anos_ordenados):
        eh_extremidade = indice == 0 or indice == n - 1
        validar_lista_geracao_ano(geracao_por_ano_raw[chave], chave, permitir_parcial=eh_extremidade)

    anos_usados = anos_ordenados[:prazo_anos]

    resultado: Dict[int, pd.DataFrame] = {}
    for ano_simulado, chave_origem in enumerate(anos_usados, start=1):
        geracao = geracao_por_ano_raw[chave_origem]
        indice = pd.date_range('2000-01-01', periods=len(geracao), freq='h')
        resultado[ano_simulado] = pd.DataFrame({
            'data_hora': indice,
            'geracao_mw': geracao,
        })

    return resultado


def resumo_ugc(geracao_por_ano_raw: Dict[str, List[float]]) -> dict:
    """Estatísticas rápidas para o preview pós-upload."""
    anos_ordenados = sorted(geracao_por_ano_raw.keys(), key=lambda k: int(k))
    resumo_por_ano = []
    for chave in anos_ordenados:
        geracao = geracao_por_ano_raw[chave]
        resumo_por_ano.append({
            'ano': int(chave),
            'n_horas': len(geracao),
            'geracao_media_mw': sum(geracao) / len(geracao) if geracao else 0.0,
            'geracao_max_mw': max(geracao) if geracao else 0.0,
            'energia_total_mwh': sum(geracao),
        })
    return {'n_anos': len(anos_ordenados), 'anos': resumo_por_ano}
