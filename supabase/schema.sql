-- ============================================================================
-- Schema do Supabase para a ferramenta de modelagem de BESS.
-- Rode isto no SQL Editor do seu projeto Supabase (Dashboard > SQL Editor).
-- ============================================================================

-- Extensão para gerar UUIDs (geralmente já vem habilitada por padrão)
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- projects: um projeto = um conjunto de inputs (config técnica + financeira)
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null default 'Novo projeto',
    seed integer not null default 2026,
    bess_config jsonb not null,
    financeiro_config jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user_id on public.projects(user_id);

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

alter table public.projects enable row level security;
alter table public.simulation_results enable row level security;
alter table public.sensitivity_jobs enable row level security;

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
