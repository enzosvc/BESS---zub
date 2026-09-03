-- ============================================================================
-- Schema do Supabase para a ferramenta de modelagem de BESS.
-- Rode isto no SQL Editor do seu projeto Supabase (Dashboard > SQL Editor).
-- ============================================================================

-- Extensão para gerar UUIDs (geralmente já vem habilitada por padrão)
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- price_scenarios: cenários de preço horário (PLD real ou projeção), usados
-- pelos modelos de negócio 'arbitragem_standalone' e 'arbitragem_fv_bess'.
--
-- `precos_por_ano` guarda só os números (compacto): {"1": [8760 floats], "2": [...], ...},
-- uma chave por ano SIMULADO (1..prazo_anos do projeto que for usar o cenário) — não
-- por ano calendário. Os timestamps horários são reconstruídos em tempo de simulação
-- (ver app/simulation/price_scenario.py) porque a data real não importa para o motor,
-- só a posição dentro do dia (hora 0-23) e o agrupamento em blocos de 24h.
-- ----------------------------------------------------------------------------
create table if not exists public.price_scenarios (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null default 'Cenário de preço',
    submercado text check (submercado in ('SUDESTE', 'SUL', 'NORDESTE', 'NORTE') or submercado is null),
    fonte text,  -- ex.: 'PLD CCEE 2021-2025', 'Projeção EPE PDE 2035' — texto livre, informativo
    precos_por_ano jsonb not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_price_scenarios_user_id on public.price_scenarios(user_id);

-- ----------------------------------------------------------------------------
-- projects: um projeto = um conjunto de inputs (config técnica + financeira)
--
-- `business_model` discrimina qual motor de simulação roda esse projeto:
--   'lrcap'                 -> engine.py (BID contratado, penalidade de não-atendimento)
--   'arbitragem_standalone' -> engine_arbitragem.py, fin.fv_acoplado=false
--   'arbitragem_fv_bess'    -> engine_arbitragem.py, fin.fv_acoplado=true
-- `bess_config`/`financeiro_config` continuam jsonb genéricos — o formato exato
-- de cada um depende de `business_model` (ver schemas.py: ConfigFinanceiraInput
-- para 'lrcap', ConfigFinanceiraArbitragemInput para os outros dois).
-- `price_scenario_id` só é usado (e obrigatório) quando business_model começa
-- com 'arbitragem_' — projetos LRCAP não geram preço de mercado.
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null default 'Novo projeto',
    seed integer not null default 2026,
    segmento text not null default 'utility'
        check (segmento in ('utility', 'cei')),
    business_model text not null default 'lrcap'
        check (business_model in ('lrcap', 'arbitragem_standalone', 'arbitragem_fv_bess')),
    bess_config jsonb not null,
    financeiro_config jsonb not null,
    price_scenario_id uuid references public.price_scenarios(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- migração idempotente para bancos criados antes do modelo de arbitragem existir
alter table public.projects add column if not exists business_model text not null default 'lrcap';
alter table public.projects add column if not exists price_scenario_id uuid references public.price_scenarios(id) on delete restrict;
do $$ begin
    if not exists (
        select 1 from pg_constraint where conname = 'projects_business_model_check'
    ) then
        alter table public.projects
            add constraint projects_business_model_check
            check (business_model in ('lrcap', 'arbitragem_standalone', 'arbitragem_fv_bess'));
    end if;
end $$;

-- migração idempotente para bancos criados antes dos segmentos Utility/C&I existirem —
-- o default 'utility' já se aplica automaticamente a toda linha pré-existente
alter table public.projects add column if not exists segmento text not null default 'utility';
do $$ begin
    if not exists (
        select 1 from pg_constraint where conname = 'projects_segmento_check'
    ) then
        alter table public.projects
            add constraint projects_segmento_check
            check (segmento in ('utility', 'cei'));
    end if;
end $$;

create index if not exists idx_projects_segmento on public.projects(segmento);

create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_projects_price_scenario_id on public.projects(price_scenario_id);

-- ----------------------------------------------------------------------------
-- simulation_results: histórico de resultados de simulações síncronas
-- ----------------------------------------------------------------------------
create table if not exists public.simulation_results (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    result jsonb not null,
    model_version text,
    created_at timestamptz not null default now()
);

-- migração idempotente: garante a coluna mesmo se a tabela já existir de antes
-- (rode este bloco de novo no SQL Editor se você já criou as tabelas anteriormente)
alter table public.simulation_results add column if not exists model_version text;

create index if not exists idx_simulation_results_project_id on public.simulation_results(project_id);

-- ----------------------------------------------------------------------------
-- sensitivity_jobs: jobs assíncronos da análise de sensibilidade (Bloco 8.2)
-- ----------------------------------------------------------------------------
create table if not exists public.sensitivity_jobs (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
    progresso_feito integer not null default 0,
    progresso_total integer not null default 0,
    resultado jsonb,
    erro text,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    completed_at timestamptz
);

create index if not exists idx_sensitivity_jobs_project_id on public.sensitivity_jobs(project_id);

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS)
--
-- O BACKEND usa a service_role key, que ignora RLS por padrão — as políticas
-- abaixo protegem contra acesso direto ao banco (ex.: se alguém pegar a anon
-- key e tentar consultar direto via supabase-js no browser, sem passar pela
-- API). A checagem "de verdade" (server-side) continua sendo feita no backend
-- (ver app/api/routes.py) — trate isto como uma segunda camada de defesa.
-- ----------------------------------------------------------------------------

alter table public.price_scenarios enable row level security;
alter table public.projects enable row level security;
alter table public.simulation_results enable row level security;
alter table public.sensitivity_jobs enable row level security;

create policy "usuarios veem só os próprios cenários de preço"
    on public.price_scenarios for select
    using (auth.uid() = user_id);

create policy "usuarios criam cenários de preço para si mesmos"
    on public.price_scenarios for insert
    with check (auth.uid() = user_id);

create policy "usuarios excluem só os próprios cenários de preço"
    on public.price_scenarios for delete
    using (auth.uid() = user_id);

create policy "usuarios veem só os próprios projetos"
    on public.projects for select
    using (auth.uid() = user_id);

create policy "usuarios criam projetos para si mesmos"
    on public.projects for insert
    with check (auth.uid() = user_id);

create policy "usuarios editam só os próprios projetos"
    on public.projects for update
    using (auth.uid() = user_id);

create policy "usuarios excluem só os próprios projetos"
    on public.projects for delete
    using (auth.uid() = user_id);

create policy "usuarios veem resultados dos próprios projetos"
    on public.simulation_results for select
    using (
        exists (
            select 1 from public.projects
            where projects.id = simulation_results.project_id
            and projects.user_id = auth.uid()
        )
    );

create policy "usuarios veem jobs dos próprios projetos"
    on public.sensitivity_jobs for select
    using (
        exists (
            select 1 from public.projects
            where projects.id = sensitivity_jobs.project_id
            and projects.user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- Trigger: atualiza updated_at automaticamente em projects
-- ----------------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
    before update on public.projects
    for each row
    execute function public.tocar_updated_at();
