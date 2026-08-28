"""
Cliente Supabase do backend.

Usa a SERVICE ROLE KEY (não a anon key) — isso ignora as políticas de RLS,
então TODA verificação de "esse usuário pode ver/editar esse projeto?" precisa
ser feita explicitamente no código das rotas (comparando project.user_id com o
user_id extraído do JWT em `auth.py`). Nunca exponha a service role key no
frontend — ela só vive nas variáveis de ambiente do backend.
"""
import os
from functools import lru_cache

from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


@lru_cache
def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidas "
            "nas variáveis de ambiente do backend (ver .env.example)."
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
