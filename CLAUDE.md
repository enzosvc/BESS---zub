# BESS ZUB — instruções para o Claude

Plataforma de modelagem técnico-financeira de BESS (Battery Energy Storage System).
Repositório próprio, independente do **ZUB** (painel pessoal, repo `enzosvc/ZUB-V2`).
São duas plataformas diferentes: não misturar código, banco ou decisões entre elas.

Responda sempre em português, de forma direta e concisa.

## Stack e deploy

- `backend/` — FastAPI (Python), deploy no Render. Motor de simulação em `backend/app/simulation/`.
- `frontend/` — Next.js 14 (App Router) + Tailwind + recharts, deploy no Vercel. Fontes IBM Plex via `next/font/google`.
- `supabase/schema.sql` — Postgres + Auth. O backend usa a service-role key (ignora RLS), então **cada rota confere manualmente** `project.user_id == user_id`.
- Segredos (`.env`, `.env.local`, chaves `sb_secret_...`) nunca vão para o git nem para o frontend.

## Modelos de negócio

| Modelo | Segmento | Como despacha |
|---|---|---|
| LRCAP | Utility | Contratual, com augmentation (gatilho contratual). Código original, **intocável** por outros modelos. |
| Autônomo (`arbitragem_standalone`) | Utility | Arbitragem pura por PLD, sempre standalone. Sem augmentation. |
| Colocalizado | Utility | BESS carrega de uma curva real de geração (UGC) e descarrega por PLD. Sem augmentation. |
| Arbitragem (`arbitragem_standalone` / `arbitragem_fv_bess`) | C&I | Despacho por PLD; FV+BESS opcional. |

Segmentos no app: `utility` e `cei` (C&I). Tema por segmento em `frontend/lib/segmentTheme.ts` (Utility azul, C&I vinho), via variáveis CSS `--accent*`.

Artefatos de upload: **Cenários de preço** (PLD por ano, colunas Data/Hora/Submercado/PLD) e **UGC** (Unidades de Geração e Consumo, colunas Data/Hora/Unidade/Geracao_MW). Primeiro e último ano podem ser parciais; anos intermediários precisam ter 8760/8784 horas. Horizonte = `min(prazo_anos, anos do cenário)`, sem ciclar dados.

## Regras de negócio já decididas

- Despacho por preço usa alocação **waterfall** (`despacho_precos.py`): descarga nas horas mais caras do mesmo dia da carga, potência ajustada para aproveitar o máximo das horas caras, mesmo com carga parcial. Vale para Utility (exceto LRCAP) e C&I.
- Autônomo (Utility) é **necessariamente standalone**: regra aplicada no frontend (sem toggle FV+BESS) **e** no backend (`fv_acoplado_efetivo = fv_acoplado and segmento != "utility"`).
- Augmentation foi **removido** de Autônomo/Colocalizado (manual e otimizado): não há compromisso externo que justifique gatilho de reinvestimento. Só o LRCAP tem augmentation.
- Sizing da bateria como saída (modo "Otimizar"): variável de busca única = `capacidade_nominal_mwh`; C-rate é input fixo; CAPEX/OPEX em R$/MWh; SOC fixo no código; sem penalidade de disponibilidade. Métrica VPL ou TIR (VPL é o correto para dimensionar; TIR serve para comparar/limiar — podem divergir muito).

## Estado atual e próximos passos

Atualizado em 2026-10-05. Toda a seção reflete a `main`; não há trabalho em andamento em outra branch.

Pendente:
- [ ] **Motor de otimização do sizing** (modo "Otimizar"), seguindo as regras de sizing acima. Hoje só existe o toggle `frontend/components/DimensionamentoToggle.tsx`, que bloqueia salvar em modo Otimizar. Mudança grande: discutir o desenho antes de implementar.
- [ ] **Simplificar o formulário técnico de Autônomo/Colocalizado**: remover "Dimensionamento e C-rate", "Janela Operacional SOC" e "Disponibilidade". Já foi discutido, mas **aguarda confirmação do Enzo**.

## Regras de trabalho

1. **O LRCAP não pode ser afetado.** Novos modelos entram como arquivos novos + guardas mínimas e comprovadamente aditivas nos arquivos compartilhados (`routes.py`, `annual.py`). Comprove com `git diff` quando mexer em arquivo compartilhado.
2. **Discuta antes de mudanças grandes ou de arquitetura**; só implemente após a confirmação do Enzo.
3. Regras de negócio são validadas no frontend **e** no backend; o backend nunca confia no valor enviado pelo cliente.
4. Respostas JSON passam por `sanear_json()` (`json_safe.py`): NaN/Infinity quebram `json.dumps` e causaram o "Failed to fetch" já visto.
5. Parsing de CSV aceita vírgula e ponto decimal (`parseNumero()`); nunca usar `parseFloat` direto em números brasileiros ("204,37" vira 204).
6. TIR: usar busca adaptativa (alargar limites), nunca "ano fictício" para forçar convergência.
7. Sem código morto. Antes de commitar:
   - Backend: `python -m pyflakes backend/app` e import/teste real com as dependências instaladas.
   - Frontend: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` e `npm run build`.
8. Mudança de schema do Supabase: atualize `supabase/schema.sql` **e** entregue ao Enzo o SQL incremental e idempotente para rodar no SQL Editor. Se não houver mudança de schema, diga explicitamente.
9. Antes de dar push, rode `git fetch origin main` e confirme que a branch local está em dia.
10. **Continuidade entre sessões:** o trabalho é retomado em sessões novas, que só conhecem este arquivo. Ao fim de cada sessão (ou antes de uma pausa), atualize "Estado atual e próximos passos" no mesmo commit do trabalho: o que foi concluído (remova o item), o que ficou em andamento (com a branch) e o que vem a seguir. Decisões novas vão para "Regras de negócio já decididas".

## Comandos úteis

```bash
# backend
cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt && uvicorn app.main:app --reload
# frontend
cd frontend && npm install && npm run dev
```

O README.md tem o passo a passo de deploy (Supabase, Render, Vercel) e a tabela de arquivos do motor.
