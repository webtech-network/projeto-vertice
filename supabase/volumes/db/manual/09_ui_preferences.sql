-- Preferências de UI (tema, densidade de card, visão padrão de Tarefas,
-- agrupamento por projeto, colunas do Kanban fechadas, workspace ativo,
-- sidebar colapsada) — migradas do localStorage/sessionStorage pro Postgres
-- pra refletir entre dispositivos do mesmo login. Não é dado secreto (ao
-- contrário de integrations/ai_provider_keys) — RLS igual a
-- workspaces/projects/tasks: select/insert/update do próprio dono.
--
-- Uma linha por usuário só (não um histórico) — daí user_id como PK direto,
-- não um id próprio + unique(user_id).
--
-- Arquivo manual porque este banco já foi inicializado — a mesma DDL também
-- foi adicionada a volumes/db/init/04_schema.sql e volumes/db/init/05_rls.sql
-- pra instalações novas terem isso de cara.
--
-- Rode depois que os 5 serviços estiverem saudáveis:
--   docker compose exec -T db psql -U postgres -d postgres < volumes/db/manual/09_ui_preferences.sql

create table public.ui_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  card_density text not null default 'expanded' check (card_density in ('expanded', 'condensed')),
  tasks_view text not null default 'kanban' check (tasks_view in ('kanban', 'eisenhower', 'table')),
  group_by_project boolean not null default false,
  collapsed_columns text[] not null default '{}',
  active_workspace_id uuid references public.workspaces(id) on delete set null,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  sidebar_collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.ui_preferences
  for each row execute function public.set_updated_at();

alter table public.ui_preferences enable row level security;

create policy "select own" on public.ui_preferences for select using (auth.uid() = user_id);
create policy "insert own" on public.ui_preferences for insert with check (auth.uid() = user_id);
create policy "update own" on public.ui_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
