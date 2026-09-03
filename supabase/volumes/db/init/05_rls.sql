-- RLS da Fase 1. Ver plano para o racional.

alter table public.workspaces enable row level security;
alter table public.projects   enable row level security;
alter table public.tasks      enable row level security;
alter table public.integrations enable row level security;

-- workspaces / projects / tasks: dono só enxerga e mexe no próprio dado.
-- Sem policy de DELETE físico — soft delete via UPDATE (deleted_at) já cobre
-- a exclusão que a app usa; DELETE fica negado por padrão.
do $$
declare
  t text;
begin
  foreach t in array array['workspaces', 'projects', 'tasks'] loop
    execute format('create policy "select own" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "insert own" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "update own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- integrations: RLS ativo, ZERO policies para anon/authenticated — de
-- propósito. Único acesso é via service_role (que ignora RLS por definição
-- no Postgres do Supabase), sempre a partir de rotas server-side do Next.js.
-- Isso é o que garante que os tokens não vazem nem por engano via REST/
-- Realtime, mesmo antes de considerar a cifra do Vault.
