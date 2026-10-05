"""
Rotas da comparação de projetos — só leitura, sobre resultados já salvos em
`simulation_results`. Não roda simulação nem altera nenhum projeto.

Regras (validadas aqui e também no frontend):
  - só entra na comparação projeto com pelo menos uma simulação salva;
  - de 2 a 10 projetos por comparação;
  - LRCAP só se compara com LRCAP; Autônomo, Colocalizado e Arbitragem C&I
    se comparam entre si (mesmas métricas: VPL/TIR/receita). No LRCAP o VPL
    é zero por construção (o BID é resolvido pra isso), então misturar as
    duas famílias induziria a erro;
  - resultado "desatualizado" (projeto alterado depois da última simulação)
    pode ser comparado, mas vai marcado para o frontend avisar.

Posse: como nas demais rotas, cada projeto é conferido contra o user_id do JWT
(ver `_buscar_projeto_do_usuario` em routes.py).
"""
from __future__ import annotations

from typing import Literal, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import obter_usuario_atual
from ..db import get_supabase
from .routes import _buscar_projeto_do_usuario

router = APIRouter(prefix="/api/comparacao")

MIN_PROJETOS = 2
MAX_PROJETOS = 10


def familia_do_modelo(business_model: str) -> str:
    return "lrcap" if business_model == "lrcap" else "preco"


def _ultima_simulacao(project_id: str, colunas: str) -> Optional[dict]:
    supabase = get_supabase()
    resp = (
        supabase.table("simulation_results")
        .select(colunas)
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def _desatualizado(projeto: dict, simulacao: dict) -> bool:
    """O trigger do banco atualiza `updated_at` a cada alteração do projeto;
    se ela for posterior à última simulação, o resultado salvo pode não
    refletir mais os inputs atuais."""
    return pd.Timestamp(projeto["updated_at"]) > pd.Timestamp(simulacao["created_at"])


def _nomes_por_id(tabela: str, ids: set[str], user_id: str) -> dict[str, str]:
    if not ids:
        return {}
    supabase = get_supabase()
    resp = supabase.table(tabela).select("id, name").in_("id", list(ids)).eq("user_id", user_id).execute()
    return {row["id"]: row["name"] for row in resp.data}


@router.get("/candidatos")
def listar_candidatos(segmento: Literal["utility", "cei"], user_id: str = Depends(obter_usuario_atual)):
    """Projetos do segmento, cada um com o resumo da última simulação salva
    (ou `ultima_simulacao = null`, se nunca rodou — o frontend mostra esses
    desabilitados)."""
    supabase = get_supabase()
    projetos = (
        supabase.table("projects")
        .select("id, name, business_model, updated_at")
        .eq("user_id", user_id)
        .eq("segmento", segmento)
        .order("updated_at", desc=True)
        .execute()
    ).data

    saida = []
    for projeto in projetos:
        simulacao = _ultima_simulacao(projeto["id"], "created_at, model_version")
        saida.append({
            **projeto,
            "familia": familia_do_modelo(projeto["business_model"]),
            "ultima_simulacao": simulacao,
            "desatualizado": simulacao is not None and _desatualizado(projeto, simulacao),
        })
    return saida


@router.get("")
def comparar(ids: str = Query(..., description="IDs dos projetos, separados por vírgula"),
             user_id: str = Depends(obter_usuario_atual)):
    lista_ids = list(dict.fromkeys(i.strip() for i in ids.split(",") if i.strip()))
    if not MIN_PROJETOS <= len(lista_ids) <= MAX_PROJETOS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Selecione de {MIN_PROJETOS} a {MAX_PROJETOS} projetos (recebido: {len(lista_ids)}).",
        )

    projetos = [_buscar_projeto_do_usuario(pid, user_id) for pid in lista_ids]  # 404/403 se não for dono

    familias = {familia_do_modelo(p["business_model"]) for p in projetos}
    if len(familias) > 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "LRCAP só pode ser comparado com LRCAP — Autônomo, Colocalizado e Arbitragem se comparam entre si.",
        )

    nomes_cenario = _nomes_por_id(
        "price_scenarios", {p["price_scenario_id"] for p in projetos if p.get("price_scenario_id")}, user_id
    )
    nomes_ugc = _nomes_por_id(
        "ugc_scenarios", {p["ugc_scenario_id"] for p in projetos if p.get("ugc_scenario_id")}, user_id
    )

    itens = []
    for projeto in projetos:
        simulacao = _ultima_simulacao(projeto["id"], "result, created_at, model_version")
        if simulacao is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"O projeto \"{projeto['name']}\" ainda não tem simulação salva — rode a simulação antes de comparar.",
            )
        # o perfil de despacho (centenas/milhares de pontos) não é usado na comparação
        resultado = {k: v for k, v in simulacao["result"].items() if k != "perfil_ordens"}
        itens.append({
            "id": projeto["id"],
            "name": projeto["name"],
            "business_model": projeto["business_model"],
            "segmento": projeto["segmento"],
            "updated_at": projeto["updated_at"],
            "simulado_em": simulacao["created_at"],
            "versao_modelo": simulacao["model_version"],
            "desatualizado": _desatualizado(projeto, simulacao),
            "cenario_preco_nome": nomes_cenario.get(projeto.get("price_scenario_id")),
            "ugc_nome": nomes_ugc.get(projeto.get("ugc_scenario_id")),
            "resultado": resultado,
        })

    return {"familia": familias.pop(), "projetos": itens}
