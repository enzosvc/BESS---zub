# BESS Modelagem — App de Modelagem Técnico-Financeira de BESS

Ferramenta web que roda o motor de simulação de BESS (portado do notebook
`BESS_Modelo_Detalhado`) com formulário de input, gráficos de resultado, login
por usuário e histórico de projetos.

## Arquitetura

```
frontend/   Next.js (React) — deploy no Vercel
backend/    FastAPI (Python) — deploy no Render ou Railway
supabase/   schema.sql — banco (Postgres) + autenticação, no Supabase
```

O frontend nunca fala direto com o banco para operações protegidas — ele chama
o backend, que valida o login (JWT do Supabase) e só então lê/escreve no banco
usando a service role key.

---

## Passo 1 — Criar o projeto no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto.
2. Vá em **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e rode.
3. Vá em **Authentication > Providers** e confirme que "Email" está habilitado
   (é o padrão). Se quiser exigir confirmação de e-mail antes do primeiro
   login, isso já vem ligado por padrão — desligue em **Authentication >
   Settings** se preferir login imediato sem confirmar e-mail (útil para
   testes internos).
4. Anote 3 valores, em **Settings > API**:
   - **Project URL** → vai virar `SUPABASE_URL` (backend) e
     `NEXT_PUBLIC_SUPABASE_URL` (frontend)
   - **anon public key** → vai virar `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend)
   - **service_role secret key** → vai virar `SUPABASE_SERVICE_ROLE_KEY`
     (backend — **nunca** coloque essa chave no frontend)
5. Em **Settings > API > JWT Settings**, copie o **JWT Secret** → vai virar
   `SUPABASE_JWT_SECRET` (backend).

## Passo 2 — Subir o backend (Render, exemplo)

1. Suba a pasta `backend/` para um repositório no GitHub (pode ser o mesmo
   repositório do frontend, em pastas separadas, ou dois repositórios — os
   dois funcionam).
2. Em [render.com](https://render.com), crie um **Web Service** novo, apontando
   para esse repositório (raiz = `backend/`, se for um monorepo).
3. Render detecta o `Dockerfile` automaticamente. Se preferir não usar Docker,
   configure manualmente:
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Em **Environment**, adicione as 4 variáveis do `.env.example`:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`,
   `FRONTEND_ORIGIN` (deixe `*` por enquanto, ajusta depois do passo 3).
5. Depois do deploy, teste: `https://seu-backend.onrender.com/health` deve
   responder `{"status": "ok"}`. A documentação interativa da API fica em
   `https://seu-backend.onrender.com/docs`.

**Railway ou Fly.io** funcionam de forma equivalente — todos suportam o
`Dockerfile` incluído sem alterações.

## Passo 3 — Subir o frontend no Vercel

1. Em [vercel.com](https://vercel.com), importe o repositório, apontando a
   raiz do projeto para `frontend/` (se for monorepo, o Vercel pergunta o
   "Root Directory" na tela de import — configure lá).
2. Em **Environment Variables**, adicione as 3 do `.env.local.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` → a URL do backend do Passo 2
     (ex.: `https://seu-backend.onrender.com`)
3. Deploy. O Vercel te dá uma URL (ex.: `https://bess-app.vercel.app`).
4. Volte no Render (backend) e atualize `FRONTEND_ORIGIN` para essa URL exata
   — isso restringe o CORS só ao seu frontend (mais seguro que `*` em produção).

## Passo 4 — Testar

1. Abra a URL do Vercel, crie uma conta (e-mail + senha).
2. Se a confirmação de e-mail estiver ligada no Supabase, confirme o e-mail
   antes de tentar logar.
3. Clique em **+ Novo projeto**, ajuste os parâmetros (ou deixe os padrões) e
   salve.
4. Na página do projeto, clique em **Rodar simulação** — deve levar 1-2
   segundos e mostrar os cartões de resultado + gráficos.
5. Clique em **Rodar análise de sensibilidade** — leva ~90 segundos (barra de
   progresso via polling); ao terminar, mostra o gráfico com as 5 curvas.

---

## Rodando localmente (desenvolvimento)

**Backend:**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # preencha com os valores do seu projeto Supabase
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.local.example .env.local   # preencha; NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

---

## Estrutura do motor de simulação (backend/app/simulation/)

Cada arquivo corresponde a um bloco do notebook original:

| Arquivo | Bloco do notebook | Conteúdo |
|---|---|---|
| `config.py` | Bloco 2 | Dataclasses `ConfigBESSDetalhado` / `ConfigFinanceiraDetalhada` |
| `orders.py` | Bloco 3 | Perfil sintético de ordens (carga determinística + descarga aleatória) |
| `battery.py` | Blocos 4-5 | Eficiência, potência máxima por SOC, cadeia de perdas |
| `annual.py` | Bloco 6 | Simulação de 1 ano, passo a passo de 15 min |
| `lifecycle.py` | Bloco 7 | Laço de 15 anos — SOH, capacidade líquida, augmentation |
| `financial.py` | Bloco 8 | OPEX/TUST, custos, fluxo de caixa, VPL, TIR, BID de equilíbrio |
| `sensitivity.py` | Bloco 8.2 | Curvas de sensibilidade contínua (5 fatores) |
| `engine.py` | — | Orquestrador: chama tudo em sequência e serializa o resultado |

Uma correção importante feita na portagem: no notebook, `simular_15_anos`
referenciava `fin` como variável global (funciona numa sessão única do
Jupyter). Aqui, `fin` é sempre passado explicitamente como parâmetro — essencial
porque o backend atende várias simulações concorrentes de usuários diferentes.

## Limitações conhecidas desta v1 (próximos passos sugeridos)

- **Job assíncrono simples:** a análise de sensibilidade roda numa thread do
  próprio processo do backend (`BackgroundTasks` do FastAPI), não numa fila de
  verdade. Funciona bem para uso interno de uma equipe; se o uso crescer muito
  (muitos usuários rodando sensibilidade ao mesmo tempo), migrar para
  Celery+Redis ou RQ sem mudar o contrato da API.
- **Sem cache de simulação:** cada clique em "Rodar simulação" recalcula tudo
  do zero (rápido, ~1-2s, então não é um problema real hoje).
- **Formulário sem validação cruzada:** o Pydantic valida cada campo
  isoladamente (ex.: `soc_min < soc_max` não é verificado); erros desse tipo
  hoje só aparecem como uma exceção genérica na hora de simular.
- **Só "modelagem para Utility"** — a extensão para outros usos de BESS
  (mencionada na conversa original) ainda não foi modelada; a arquitetura
  (motor desacoplado de config) foi pensada para comportar isso depois, com
  um novo conjunto de `ConfigXxx` + rotas, sem precisar reescrever o que já
  existe.
