"""
Carimbo de versão do modelo — deixa registrado, em cada resultado, QUAL versão
do código (commit do git) gerou aquele número. Sem isso, comparar dois
resultados diferentes do mesmo projeto no futuro não diz se a mudança veio de
um input diferente ou de uma correção no motor de simulação.

O Render expõe automaticamente o commit atual na variável de ambiente
RENDER_GIT_COMMIT (documentado em render.com/docs/environment-variables) —
não precisa configurar nada manualmente, ela já vem populada em produção.
Em desenvolvimento local (sem essa variável), cai para "dev".
"""
import os

_HASH_CURTO_TAMANHO = 7


def obter_versao_modelo() -> str:
    commit_completo = os.environ.get("RENDER_GIT_COMMIT", "")
    if commit_completo:
        return commit_completo[:_HASH_CURTO_TAMANHO]
    return "dev"
