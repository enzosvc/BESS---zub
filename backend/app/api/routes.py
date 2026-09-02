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
from ..schemas import (
    ConfigBESSInput, ConfigFinanceiraInput, SimulacaoInput,
    ConfigFinanceiraArbitragemInput, SimulacaoArbitragemInput, PriceScenarioInput,
)
from ..simulation.config import ConfigBESSDetalhado, ConfigFinanceiraDetalhada
from ..simulation.engine import rodar_simulacao_completa
from ..simulation.financial_arbitragem import ConfigFinanceiraArbitragem
from ..simulation.engine_arbitragem import rodar_simulacao_arbitragem
from ..simulation.price_scenario import construir_precos_por_ano, resumo_cenario, CenarioPrecoInvalido
from ..jobs.sensitivity_worker import rodar_job_sensibilidade

router = APIRouter(prefix="/api")

BUSINESS_MODELS_ARBITRAGEM = ("arbitragem_standalone", "arbitragem_fv_bess")


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


def _para_fin_arbitragem(input_fin: ConfigFinanceiraArbitragemInput, prazo_anos: int) -> ConfigFinanceiraArbitragem:
    dados = input_fin.model_dump()
    dados["prazo_anos"] = prazo_anos
    return ConfigFinanceiraArbitragem(**dados)


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
    """Cria um projeto do modelo LRCAP. Para arbitragem, ver POST /api/projects/arbitragem."""
    supabase = get_supabase()
    registro = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": payload.nome or "Novo projeto",
        "seed": payload.seed,
        "business_model": "lrcap",
        "bess_config": payload.bess.model_dump(),
        "financeiro_config": payload.financeiro.model_dump(),
    }
    resp = supabase.table("projects").insert(registro).execute()
    return resp.data[0]


@router.post("/projects/arbitragem", status_code=status.HTTP_201_CREATED)
def criar_projeto_arbitragem(payload: SimulacaoArbitragemInput, user_id: str = Depends(obter_usuario_atual)):
    """Cria um projeto do modelo de arbitragem (standalone ou FV+BESS, conforme
    `payload.financeiro.fv_acoplado`). Requer um price_scenario_id já existente
    — ver POST /api/price-scenarios."""
    _buscar_price_scenario_do_usuario(payload.price_scenario_id, user_id)  # 404/403 se não existir/não for do dono

    supabase = get_supabase()
    registro = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": payload.nome or "Novo projeto de arbitragem",
        "seed": payload.seed,
        "business_model": "arbitragem_fv_bess" if payload.financeiro.fv_acoplado else "arbitragem_standalone",
        "bess_config": payload.bess.model_dump(),
        "financeiro_config": payload.financeiro.model_dump(),
        "price_scenario_id": payload.price_scenario_id,
    }
    resp = supabase.table("projects").insert(registro).execute()
    return resp.data[0]


@router.get("/projects/{project_id}")
def obter_projeto(project_id: str, user_id: str = Depends(obter_usuario_atual)):
    projeto = _buscar_projeto_do_usuario(project_id, user_id)
    return projeto


@router.put("/projects/{project_id}")
def atualizar_projeto(project_id: str, payload: SimulacaoInput, user_id: str = Depends(obter_usuario_atual)):
    projeto = _buscar_projeto_do_usuario(project_id, user_id)  # 404/403 se não for dono
    if projeto["business_model"] != "lrcap":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Esse projeto é de arbitragem — use PUT /api/projects/{project_id}/arbitragem.",
        )
    supabase = get_supabase()
    resp = supabase.table("projects").update({
        "name": payload.nome or "Projeto sem nome",
        "seed": payload.seed,
        "bess_config": payload.bess.model_dump(),
        "financeiro_config": payload.financeiro.model_dump(),
        "updated_at": "now()",
    }).eq("id", project_id).execute()
    return resp.data[0]


@router.put("/projects/{project_id}/arbitragem")
def atualizar_projeto_arbitragem(project_id: str, payload: SimulacaoArbitragemInput,
                                  user_id: str = Depends(obter_usuario_atual)):
    projeto = _buscar_projeto_do_usuario(project_id, user_id)
    if projeto["business_model"] not in BUSINESS_MODELS_ARBITRAGEM:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Esse projeto é LRCAP — use PUT /api/projects/{project_id}.",
        )
    _buscar_price_scenario_do_usuario(payload.price_scenario_id, user_id)

    supabase = get_supabase()
    resp = supabase.table("projects").update({
        "name": payload.nome or "Projeto sem nome",
        "seed": payload.seed,
        "business_model": "arbitragem_fv_bess" if payload.financeiro.fv_acoplado else "arbitragem_standalone",
        "bess_config": payload.bess.model_dump(),
        "financeiro_config": payload.financeiro.model_dump(),
        "price_scenario_id": payload.price_scenario_id,
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


def _rodar_simulacao_ou_erro_400(cfg: ConfigBESSDetalhado, fin: ConfigFinanceiraDetalhada, seed: int) -> dict:
    """Roda a simulação, convertendo erros de validação de input (ex.: curvas
    de RTE/SOH mais curtas que o prazo do contrato) em HTTP 400 — com a
    mensagem exata do erro — em vez de um 500 genérico."""
    try:
        return rodar_simulacao_completa(cfg, fin, seed=seed)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))


# ---------------------------------------------------------------------------
# Cenários de preço (usados pelos modelos de arbitragem)
# ---------------------------------------------------------------------------

@router.post("/price-scenarios", status_code=status.HTTP_201_CREATED)
def criar_price_scenario(payload: PriceScenarioInput, user_id: str = Depends(obter_usuario_atual)):
    precos_por_ano_raw = {str(item.ano): item.precos_rs_mwh for item in payload.anos}
    supabase = get_supabase()
    registro = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": payload.name,
        "submercado": payload.submercado,
        "fonte": payload.fonte,
        "precos_por_ano": precos_por_ano_raw,
    }
    resp = supabase.table("price_scenarios").insert(registro).execute()
    salvo = resp.data[0]
    return {**salvo, "resumo": resumo_cenario(precos_por_ano_raw)}


@router.get("/price-scenarios")
def listar_price_scenarios(user_id: str = Depends(obter_usuario_atual)):
    """Lista os cenários do usuário SEM o array de preços (só metadados +
    resumo) — o payload completo de um cenário de 15 anos é grande demais pra
    listar; use GET /api/price-scenarios/{id} pra ver um em detalhe."""
    supabase = get_supabase()
    resp = (
        supabase.table("price_scenarios")
        .select("id, name, submercado, fonte, created_at, precos_por_ano")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    saida = []
    for row in resp.data:
        precos = row.pop("precos_por_ano")
        row["resumo"] = resumo_cenario(precos)
        saida.append(row)
    return saida


@router.get("/price-scenarios/{scenario_id}")
def obter_price_scenario(scenario_id: str, user_id: str = Depends(obter_usuario_atual)):
    cenario = _buscar_price_scenario_do_usuario(scenario_id, user_id)
    return {**cenario, "resumo": resumo_cenario(cenario["precos_por_ano"])}


@router.delete("/price-scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_price_scenario(scenario_id: str, user_id: str = Depends(obter_usuario_atual)):
    _buscar_price_scenario_do_usuario(scenario_id, user_id)
    supabase = get_supabase()
    try:
        supabase.table("price_scenarios").delete().eq("id", scenario_id).execute()
    except Exception as exc:
        # price_scenario_id em `projects` é ON DELETE RESTRICT de propósito — apagar um
        # cenário ainda usado por um projeto deve falhar de forma clara, não em cascata.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Esse cenário está em uso por pelo menos um projeto e não pode ser excluído.",
        ) from exc


def _buscar_price_scenario_do_usuario(scenario_id: str, user_id: str) -> dict:
    supabase = get_supabase()
    resp = supabase.table("price_scenarios").select("*").eq("id", scenario_id).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cenário de preço não encontrado.")
    cenario = resp.data[0]
    if cenario["user_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esse cenário de preço não pertence a você.")
    return cenario


def _rodar_simulacao_arbitragem_ou_erro_400(cfg: ConfigBESSDetalhado, fin: ConfigFinanceiraArbitragem,
                                             precos_por_ano_raw: dict, seed: int) -> dict:
    try:
        cenario_precos_por_ano = construir_precos_por_ano(precos_por_ano_raw, cfg.prazo_anos)
        return rodar_simulacao_arbitragem(cfg, fin, cenario_precos_por_ano, seed=seed)
    except (ValueError, CenarioPrecoInvalido) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))


# ---------------------------------------------------------------------------
# Simulação síncrona (rápida — roda direto na requisição, ~1-2s)
# ---------------------------------------------------------------------------

@router.post("/simulate")
def simular(payload: SimulacaoInput, user_id: str = Depends(obter_usuario_atual)):
    cfg = _para_cfg_bess(payload.bess)
    fin = _para_fin(payload.financeiro, cfg.capacidade_nominal_mwh)
    return _rodar_simulacao_ou_erro_400(cfg, fin, payload.seed)


@router.post("/simulate-arbitragem")
def simular_arbitragem(payload: SimulacaoArbitragemInput, user_id: str = Depends(obter_usuario_atual)):
    """Simulação ad-hoc (não salva projeto) do modelo de arbitragem — usa um
    price_scenario_id já existente."""
    cenario = _buscar_price_scenario_do_usuario(payload.price_scenario_id, user_id)
    cfg = _para_cfg_bess(payload.bess)
    fin = _para_fin_arbitragem(payload.financeiro, cfg.prazo_anos)
    return _rodar_simulacao_arbitragem_ou_erro_400(cfg, fin, cenario["precos_por_ano"], payload.seed)


@router.post("/projects/{project_id}/simulate")
def simular_projeto_salvo(project_id: str, background_tasks: BackgroundTasks,
                           user_id: str = Depends(obter_usuario_atual)):
    """Roda a simulação usando o input já salvo no projeto, e persiste o resultado.
    Ramifica pelo motor certo conforme `projeto['business_model']`."""
    projeto = _buscar_projeto_do_usuario(project_id, user_id)

    if projeto["business_model"] == "lrcap":
        cfg_input = ConfigBESSInput(**projeto["bess_config"])
        fin_input = ConfigFinanceiraInput(**projeto["financeiro_config"])
        cfg = _para_cfg_bess(cfg_input)
        fin = _para_fin(fin_input, cfg.capacidade_nominal_mwh)
        resultado = _rodar_simulacao_ou_erro_400(cfg, fin, projeto["seed"])
    else:
        if not projeto.get("price_scenario_id"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Projeto de arbitragem sem price_scenario_id associado.")
        cenario = _buscar_price_scenario_do_usuario(projeto["price_scenario_id"], user_id)
        cfg_input = ConfigBESSInput(**projeto["bess_config"])
        fin_input = ConfigFinanceiraArbitragemInput(**projeto["financeiro_config"])
        cfg = _para_cfg_bess(cfg_input)
        fin = _para_fin_arbitragem(fin_input, cfg.prazo_anos)
        resultado = _rodar_simulacao_arbitragem_ou_erro_400(cfg, fin, cenario["precos_por_ano"], projeto["seed"])

    supabase = get_supabase()
    registro = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "result": resultado,
        "model_version": resultado.get("versao_modelo"),
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
    if projeto["business_model"] != "lrcap":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Análise de sensibilidade de BID só existe para projetos LRCAP — "
            "não há BID contratado no modelo de arbitragem.",
        )
    cfg_input = ConfigBESSInput(**projeto["bess_config"])
    fin_input = ConfigFinanceiraInput(**projeto["financeiro_config"])
    cfg = _para_cfg_bess(cfg_input)
    fin = _para_fin(fin_input, cfg.capacidade_nominal_mwh)

    if bid_equilibrio_rs_ano is None:
        resultado_base = _rodar_simulacao_ou_erro_400(cfg, fin, projeto["seed"])
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
