"""
Alocador de descarga por preço — compartilhado por todos os motores de
despacho guiados por cenário de preço (arbitragem Autônomo e, quando
existir, Colocalizado), tanto em Utility quanto em C&I. NÃO se aplica ao
LRCAP (orders.py), que usa janelas fixas contratuais, não preço.

Regra: independente de quanta energia foi carregada no dia (cheia, no caso
do Autônomo; parcial, no caso do Colocalizado quando a geração da usina não
enche a bateria), a descarga sempre acontece no MESMO dia, e a potência de
cada hora é ajustada pra extrair o máximo valor das horas mais caras do dia
— preenche a hora mais cara até a potência máxima do sistema, depois a
segunda mais cara, e assim por diante, até esgotar a energia disponível (ou
o dia acabar). Esse é o alocador ótimo pra "gastar" uma energia fixa num
conjunto de preços conhecidos: nenhuma outra forma de distribuir a mesma
energia nesse mesmo dia gera mais receita.

Quando a energia disponível é exatamente potência_máxima × D horas (o caso
do Autônomo, que carrega sempre até a capacidade cheia), esse alocador dá
exatamente o mesmo resultado que "as D horas mais caras à potência plena" —
ou seja, generaliza o comportamento antigo sem mudar nenhum número do
Autônomo (ver teste de regressão em test_despacho_precos.py).
"""
from __future__ import annotations

import numpy as np


def alocar_descarga_por_preco(precos_dia: np.ndarray, energia_disponivel_mwh: float,
                               potencia_maxima_mw: float) -> np.ndarray:
    """
    precos_dia: preço de cada hora do dia (tamanho N, tipicamente 24).
    energia_disponivel_mwh: quanta energia há pra descarregar nesse dia.
    potencia_maxima_mw: teto de potência de descarga do sistema.

    Retorna um array do mesmo tamanho de `precos_dia` com a potência de
    descarga (MW) alocada a cada hora — sempre <= potencia_maxima_mw, soma
    = min(energia_disponivel_mwh, potencia_maxima_mw * N).
    """
    n = len(precos_dia)
    alocacao = np.zeros(n)
    if energia_disponivel_mwh <= 0 or potencia_maxima_mw <= 0:
        return alocacao

    ordem_decrescente = np.argsort(-precos_dia)  # mais caro primeiro
    energia_restante = energia_disponivel_mwh

    for idx in ordem_decrescente:
        if energia_restante <= 1e-9:
            break
        potencia_hora = min(potencia_maxima_mw, energia_restante)
        alocacao[idx] = potencia_hora
        energia_restante -= potencia_hora

    return alocacao
