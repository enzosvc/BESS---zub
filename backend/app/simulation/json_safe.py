"""
Utilitário compartilhado entre engine.py (LRCAP) e engine_arbitragem.py.

`json.dumps` (usado pelo FastAPI para serializar a resposta) lança
`ValueError: Out of range float values are not JSON compliant` para NaN/
Infinity — e isso acontece DEPOIS que a rota já retornou o dict, no meio do
envio da resposta, então o cliente não recebe um erro HTTP limpo (só vê a
conexão cair, como um "Failed to fetch" genérico no navegador).

Fonte mais comum de NaN aqui: `financial.py::calcular_tir` retorna
`float('nan')` de propósito quando a busca de raiz (TIR) não converge —
mais comum na arbitragem (onde o VPL pode ficar fortemente negativo, sem
nenhuma taxa que zere o fluxo de caixa) do que no LRCAP (cujo fluxo já é
construído em torno do BID de equilíbrio), mas pode acontecer nos dois.
"""
from __future__ import annotations

import numpy as np


def sanear_json(obj):
    """Substitui NaN/Infinity por None recursivamente, em dicts/listas/floats
    aninhados. None vira `null` em JSON — o frontend já trata isso como
    'não disponível' (ex.: ResultCardsArbitragem exibe 'não converge')."""
    if isinstance(obj, float):
        return None if (np.isnan(obj) or np.isinf(obj)) else obj
    if isinstance(obj, dict):
        return {k: sanear_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanear_json(v) for v in obj]
    return obj
