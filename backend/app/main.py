import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router

app = FastAPI(
    title="BESS Modelagem API",
    description="Motor de simulação técnico-financeira de sistemas de armazenamento em bateria (BESS).",
    version="1.0.0",
)

# Em produção, restrinja FRONTEND_ORIGIN à URL exata do seu deploy no Vercel
# (ex.: https://bess-app.vercel.app) em vez de "*".
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN] if FRONTEND_ORIGIN != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
