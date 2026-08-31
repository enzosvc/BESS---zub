"""
Autenticação: o frontend loga via Supabase Auth e manda o JWT resultante no
header `Authorization: Bearer <token>` em toda chamada à API.

Desde outubro/2025, todo projeto NOVO da Supabase assina os tokens de sessão
com um par de chaves assimétrico (RS256/ES256), não mais com um "segredo"
compartilhado (HS256). Por isso validamos o token buscando a CHAVE PÚBLICA do
projeto no endpoint JWKS (`/auth/v1/.well-known/jwks.json`) — não precisamos
guardar nenhum segredo aqui, só a URL do projeto (que já não é sensível).
`PyJWKClient` cuida de buscar e cachear essa chave automaticamente.
"""
import os

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException, status

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")

_jwks_client: PyJWKClient | None = None


def _obter_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not SUPABASE_URL:
            raise RuntimeError("SUPABASE_URL não configurada nas variáveis de ambiente do backend.")
        _jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    return _jwks_client


def obter_usuario_atual(authorization: str = Header(...)) -> str:
    """Dependency do FastAPI: valida o JWT e devolve o user_id (uuid, string).
    Uso: `def rota(..., user_id: str = Depends(obter_usuario_atual))`."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Cabeçalho Authorization ausente ou mal formatado.")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        signing_key = _obter_jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token, signing_key.key, algorithms=["RS256", "ES256"], audience="authenticated"
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão expirada, faça login de novo.")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Token inválido: {exc}")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token sem 'sub' (user_id).")
    return user_id
