"""
Rotas da API.

Convenção de posse: toda linha em `projects`/`simulation_results`/`sensitivity_jobs`
tem um `user_id` (projects) ou é alcançada via `project_id -> projects.user_id`
(as outras duas). Como o backend usa a service role key (ignora RLS), CADA
rota abaixo confere manualmente que `project.user_id == user_id` do JWT antes
de deixar ler/escrever — não pule essa checagem em rotas novas.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from ..auth import obter_usuario_atual
from ..db import get_supabase
from ..schemas import ConfigBESSInput, ConfigFinanceiraInput, SimulacaoInput
from ..simulation.config import ConfigBESSDetalhado, ConfigFinanceiraDetalhada
from ..simulation.engine import rodar_simulacao_completa
from ..jobs.sensitivity_worker import rodar_job_sensibilidade

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# conversão dos schemas de input (Pydantic) para as dataclasses do motor
# ---------------------------------------------------------------------------

def _para_cfg_bess(input_bess: ConfigBESSInput) -> ConfigBESSDetalhado:
    dados = input_bess.model_dump()
    dados["potencia_nominal_efetiva_mw"] = dados["capacidade_nominal_mwh"] * dados["c_rate"]
    dados["mean_rte_por_ano"] = tuple(dados["mean_rte_por_ano"])
    dados["soh_referencia_por_ano"] = tuple(dados["soh_referencia_por_ano"])
    return ConfigBESSDetalhado(**dados)


def _para_fin(input_fin: ConfigFinanceiraInput, capacidade_nominal_mwh: float) -> ConfigFinanceiraDetalhada:
    dados = input_fin.model_dump()
    dados["capacidade_nominal_mwh"] = capacidade_nominal_mwh
    dados["prazo_anos"] = 15  # sincronizado com cfg.prazo_anos na rota que chama isso
    return ConfigFinanceiraDetalhada(**dados)


# ---------------------------------------------------------------------------
# Projetos (CRUD, sempre escopado ao usuário logado)
# ---------------------------------------------------------------------------

@router.get("/projects")
def listar_projetos(user_id: str = Depends(obter_usuario_atual)):
    supabase = get_supabase()
    resp = supabase.table("projects").select("*").eq("user_id", user_id).order("updated_at", desc=True).execute()
    return resp.data


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def criar_projeto(payload: SimulacaoInput, user_id: str = Depends(obter_usuario_atual)):
    supabase = get_supabase()
    registro = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": payload.nome or "Novo projeto",
        "seed": payload.seed,
        "bess_config": payload.bess.model_dump(),
        "financeiro_config": payload.financeiro.model_dump(),
    }
    resp = supabase.table("projects").insert(registro).execute()
    return resp.data[0]


@router.get("/projects/{project_id}")
def obter_projeto(project_id: str, user_id: str = Depends(obter_usuario_atual)):
    projeto = _buscar_projeto_do_usuario(project_id, user_id)
    return projeto


@router.put("/projects/{project_id}")
def atualizar_projeto(project_id: str, payload: SimulacaoInput, user_id: str = Depends(obter_usuario_atual)):
    _buscar_projeto_do_usuario(project_id, user_id)  # 404/403 se não for dono
    supabase = get_supabase()
    resp = supabase.table("projects").update({
        "name": payload.nome or "Projeto sem nome",
        "seed": payload.seed,
        "bess_config": payload.bess.model_dump(),
        "financeiro_config": payload.financeiro.model_dump(),
        "updated_at": "now()",
    }).eq("id", project_id).execute()
    return resp.data[0]


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_projeto(project_id: str, user_id: str = Depends(obter_usuario_atual)):
    _buscar_projeto_do_usuario(project_id, user_id)
    supabase = get_supabase()
    supabase.table("projects").delete().eq("id", project_id).execute()


def _buscar_projeto_do_usuario(project_id: str, user_id: str) -> dict:
    supabase = get_supabase()
    resp = supabase.table("projects").select("*").eq("id", project_id).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Projeto não encontrado.")
    projeto = resp.data[0]
    if projeto["user_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esse projeto não pertence a você.")
    return projeto


# ---------------------------------------------------------------------------
# Simulação síncrona (rápida — roda direto na requisição, ~1-2s)
# ---------------------------------------------------------------------------

@router.post("/simulate")
def simular(payload: SimulacaoInput, user_id: str = Depends(obter_usuario_atual)):
    cfg = _para_cfg_bess(payload.bess)
    fin = _para_fin(payload.financeiro, cfg.capacidade_nominal_mwh)
    resultado = rodar_simulacao_completa(cfg, fin, seed=payload.seed)
    return resultado


@router.post("/projects/{project_id}/simulate")
def simular_projeto_salvo(project_id: str, background_tasks: BackgroundTasks,
                           user_id: str = Depends(obter_usuario_atual)):
    """Roda a simulação usando o input já salvo no projeto, e persiste o resultado."""
    projeto = _buscar_projeto_do_usuario(project_id, user_id)
    cfg_input = ConfigBESSInput(**projeto["bess_config"])
    fin_input = ConfigFinanceiraInput(**projeto["financeiro_config"])

    cfg = _para_cfg_bess(cfg_input)
    fin = _para_fin(fin_input, cfg.capacidade_nominal_mwh)
    resultado = rodar_simulacao_completa(cfg, fin, seed=projeto["seed"])

    supabase = get_supabase()
    registro = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "result": resultado,
    }
    supabase.table("simulation_results").insert(registro).execute()
    return resultado


# ---------------------------------------------------------------------------
# Sensibilidade (job assíncrono — 105 simulações, ~90s)
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/sensitivity", status_code=status.HTTP_202_ACCEPTED)
def iniciar_sensibilidade(project_id: str, background_tasks: BackgroundTasks,
                           bid_equilibrio_rs_ano: Optional[float] = None,
                           user_id: str = Depends(obter_usuario_atual)):
    """Dispara o job assíncrono e devolve um job_id imediatamente. O frontend
    faz polling em GET /api/sensitivity/{job_id} até status='completed'.
    Se `bid_equilibrio_rs_ano` não for informado, roda a simulação síncrona
    primeiro para obtê-lo (o BID baseline é o denominador de toda a curva)."""
    projeto = _buscar_projeto_do_usuario(project_id, user_id)
    cfg_input = ConfigBESSInput(**projeto["bess_config"])
    fin_input = ConfigFinanceiraInput(**projeto["financeiro_config"])
    cfg = _para_cfg_bess(cfg_input)
    fin = _para_fin(fin_input, cfg.capacidade_nominal_mwh)

    if bid_equilibrio_rs_ano is None:
        resultado_base = rodar_simulacao_completa(cfg, fin, seed=projeto["seed"])
        bid_equilibrio_rs_ano = resultado_base["resultado_financeiro"]["bid_equilibrio_rs_ano"]

    supabase = get_supabase()
    job_id = str(uuid.uuid4())
    supabase.table("sensitivity_jobs").insert({
        "id": job_id,
        "project_id": project_id,
        "status": "pending",
        "progresso_feito": 0,
        "progresso_total": 105,
    }).execute()

    background_tasks.add_task(
        rodar_job_sensibilidade, job_id, cfg, fin, bid_equilibrio_rs_ano, projeto["seed"]
    )
    return {"job_id": job_id, "status": "pending"}


@router.get("/sensitivity/{job_id}")
def obter_status_sensibilidade(job_id: str, user_id: str = Depends(obter_usuario_atual)):
    supabase = get_supabase()
    resp = supabase.table("sensitivity_jobs").select("*, projects!inner(user_id)").eq("id", job_id).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job não encontrado.")
    job = resp.data[0]
    if job["projects"]["user_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esse job não pertence a você.")
    return {
        "job_id": job["id"],
        "status": job["status"],
        "progresso_feito": job["progresso_feito"],
        "progresso_total": job["progresso_total"],
        "resultado": job.get("resultado"),
        "erro": job.get("erro"),
    }
