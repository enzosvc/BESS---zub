"""
Autenticação: o frontend loga via Supabase Auth e manda o JWT resultante no
header `Authorization: Bearer <token>` em toda chamada à API. Esta função
valida esse token (usando o JWT secret do projeto Supabase) e devolve o
user_id — as rotas usam esse user_id para filtrar/checar posse dos projetos.
"""
import os

import jwt
from fastapi import Header, HTTPException, status

SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")


def obter_usuario_atual(authorization: str = Header(...)) -> str:
    """Dependency do FastAPI: valida o JWT e devolve o user_id (uuid, string).
    Uso: `def rota(..., user_id: str = Depends(obter_usuario_atual))`."""
    if not SUPABASE_JWT_SECRET:
        raise RuntimeError("SUPABASE_JWT_SECRET não configurada nas variáveis de ambiente do backend.")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Cabeçalho Authorization ausente ou mal formatado.")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(
            token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated"
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão expirada, faça login de novo.")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido.")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token sem 'sub' (user_id).")
    return user_id
