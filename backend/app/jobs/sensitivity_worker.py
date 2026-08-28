"""
Job assíncrono da análise de sensibilidade (Bloco 8.2 do notebook — 5 fatores
x 21 pontos = 105 simulações completas, ~90s). Roda em background (via
`BackgroundTasks` do FastAPI) para não bloquear a requisição HTTP; o status e
o progresso ficam gravados na tabela `sensitivity_jobs` do Supabase, e o
frontend faz polling em `GET /api/sensitivity/{job_id}` até `status='completed'`.

Nota de escala: para poucos usuários simultâneos (uso interno), rodar isso
numa thread do próprio processo FastAPI é suficiente. Se o uso crescer muito,
trocar por uma fila de verdade (Celery+Redis ou RQ) sem mudar o contrato da
API — só o "como" o job roda, não o "o quê" ele grava no banco.
"""
from __future__ import annotations

import traceback
from datetime import datetime, timezone

from ..db import get_supabase
from ..simulation.config import ConfigBESSDetalhado, ConfigFinanceiraDetalhada
from ..simulation.orders import criar_ordens_sinteticas
from ..simulation.sensitivity import calcular_curvas_sensibilidade


def _agora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def rodar_job_sensibilidade(job_id: str, cfg: ConfigBESSDetalhado, fin: ConfigFinanceiraDetalhada,
                             bid_equilibrio_baseline: float, seed: int) -> None:
    supabase = get_supabase()

    def atualizar_progresso(feito: int, total: int) -> None:
        # grava a cada ~5 passos para não hammering o banco a cada uma das 105 iterações
        if feito % 5 == 0 or feito == total:
            supabase.table("sensitivity_jobs").update({
                "status": "running",
                "progresso_feito": feito,
                "progresso_total": total,
            }).eq("id", job_id).execute()

    try:
        supabase.table("sensitivity_jobs").update({
            "status": "running",
            "started_at": _agora_iso(),
        }).eq("id", job_id).execute()

        ordens = criar_ordens_sinteticas(cfg, seed=seed)
        df_curvas = calcular_curvas_sensibilidade(
            cfg, fin, ordens, bid_equilibrio_baseline, seed=seed,
            passo=0.05, progress_callback=atualizar_progresso,
        )

        supabase.table("sensitivity_jobs").update({
            "status": "completed",
            "resultado": df_curvas.to_dict(orient="records"),
            "completed_at": _agora_iso(),
        }).eq("id", job_id).execute()

    except Exception as exc:  # noqa: BLE001 — job em background: captura tudo e grava o erro
        supabase.table("sensitivity_jobs").update({
            "status": "failed",
            "erro": f"{exc}\n{traceback.format_exc()}",
            "completed_at": _agora_iso(),
        }).eq("id", job_id).execute()
