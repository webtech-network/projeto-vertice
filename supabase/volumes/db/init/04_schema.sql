-- Schema próprio do Vértice — Fase 1.
-- Ver /Users/rommelcarneiro/.claude/plans/preciso-realizar-uma-mudan-a-eager-pine.md
-- para o racional de cada tabela. Sem tags/task_tags/settings/
-- external_references/push_subscriptions ainda — Fase 2.

create schema if not exists extensions;
create extension if not exists supabase_vault with schema vault;

-- =====================================================================
-- workspaces ("Ambiente" na UI em PT-BR; "Workspace" numa futura UI em
-- inglês — o termo de código é sempre "workspace"). Sem o workspace "Base"
-- sintético do modelo client-side antigo: "sem filtro" agora é só estado de
-- UI, nunca um registro.
-- =====================================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  -- default auth.uid() — client insere sem precisar saber o próprio id;
  -- RLS (05_rls.sql) segue garantindo que não dá pra gravar em nome de outro.
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index workspaces_user_id_idx on public.workspaces (user_id);

-- =====================================================================
-- projects
-- =====================================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  name text not null,
  type text not null default 'personal' check (type in ('personal', 'canvas-course')),
  -- Stopgap denormalizado até external_references existir (Fase 2) — ver
  -- nota "curso vinculado a workspace sem projeto" no plano.
  canvas_course_id text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index projects_user_id_idx on public.projects (user_id);
create index projects_workspace_id_idx on public.projects (workspace_id);

-- =====================================================================
-- tasks
-- =====================================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'BACKLOG'
    check (status in ('BACKLOG', 'BLOCK', 'TODO', 'DOING', 'DONE')),
  urgent boolean not null default false,
  important boolean not null default false,
  priority_rank smallint not null default 3 check (priority_rank between 0 and 9),
  tags text[] not null default '{}',
  -- date puro, não timestamptz — dueDate.js já trata isso como uma string
  -- 'YYYY-MM-DD' sem hora/timezone (mesmo formato de <input type="date">);
  -- um "date" do Postgres via PostgREST volta exatamente nesse formato.
  due_date date,
  canvas_references jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_status_idx on public.tasks (status);
create index tasks_due_date_idx on public.tasks (due_date);

-- =====================================================================
-- integrations — Canvas/GitHub/Google. Identidade de login já é resolvida
-- por auth.users/auth.identities do próprio Supabase; esta tabela é só a
-- capacidade de API de longo prazo (tokens), nunca exposta via REST/Realtime
-- diretamente — ver 05_rls.sql. Tokens NUNCA em texto plano: guardados no
-- Supabase Vault (pgsodium por baixo), só o id do secret fica aqui.
-- =====================================================================
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('canvas', 'github', 'google')),
  provider_user_id text,
  display_name text,
  avatar_url text,
  access_token_vault_id uuid,
  refresh_token_vault_id uuid,
  access_token_expires_at timestamptz,
  scopes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index integrations_user_id_idx on public.integrations (user_id);

-- ---------------------------------------------------------------------
-- Funções SECURITY DEFINER para ler/escrever os tokens cifrados.
-- Só o service_role pode executá-las (REVOKE ALL + GRANT abaixo) — chamadas
-- exclusivamente por rotas server-side do Next.js usando SERVICE_ROLE_KEY,
-- nunca pelo client do navegador.
--
-- ATENÇÃO (a confirmar no spike da Fase 1): assinaturas de vault.create_secret
-- / vault.update_secret abaixo assumem a extensão supabase_vault na versão
-- empacotada pela imagem supabase/postgres:17.6.1.136. Confirmar contra a
-- versão real rodando antes de depender disso em produção.
-- ---------------------------------------------------------------------

create or replace function public.upsert_integration_tokens(
  p_user_id uuid,
  p_provider text,
  p_access_token text,
  p_refresh_token text default null,
  p_provider_user_id text default null,
  p_display_name text default null,
  p_avatar_url text default null,
  p_access_token_expires_at timestamptz default null,
  p_scopes text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
  v_access_vault_id uuid;
  v_refresh_vault_id uuid;
  v_secret_name_prefix text := p_user_id::text || ':' || p_provider;
begin
  select id, access_token_vault_id, refresh_token_vault_id
    into v_id, v_access_vault_id, v_refresh_vault_id
    from public.integrations
    where user_id = p_user_id and provider = p_provider;

  if v_access_vault_id is not null then
    perform vault.update_secret(v_access_vault_id, p_access_token);
  else
    v_access_vault_id := vault.create_secret(p_access_token, v_secret_name_prefix || ':access:' || gen_random_uuid());
  end if;

  if p_refresh_token is not null then
    if v_refresh_vault_id is not null then
      perform vault.update_secret(v_refresh_vault_id, p_refresh_token);
    else
      v_refresh_vault_id := vault.create_secret(p_refresh_token, v_secret_name_prefix || ':refresh:' || gen_random_uuid());
    end if;
  end if;

  insert into public.integrations (
    user_id, provider, provider_user_id, display_name, avatar_url,
    access_token_vault_id, refresh_token_vault_id,
    access_token_expires_at, scopes, metadata, updated_at
  ) values (
    p_user_id, p_provider, p_provider_user_id, p_display_name, p_avatar_url,
    v_access_vault_id, v_refresh_vault_id,
    p_access_token_expires_at, p_scopes, p_metadata, now()
  )
  on conflict (user_id, provider) do update set
    provider_user_id = excluded.provider_user_id,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    access_token_vault_id = excluded.access_token_vault_id,
    refresh_token_vault_id = coalesce(excluded.refresh_token_vault_id, public.integrations.refresh_token_vault_id),
    access_token_expires_at = excluded.access_token_expires_at,
    scopes = excluded.scopes,
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_integration_tokens(
  p_user_id uuid,
  p_provider text
) returns table (
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  provider_user_id text,
  display_name text,
  avatar_url text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return query
    select
      (select decrypted_secret from vault.decrypted_secrets where id = i.access_token_vault_id),
      (select decrypted_secret from vault.decrypted_secrets where id = i.refresh_token_vault_id),
      i.access_token_expires_at,
      i.provider_user_id,
      i.display_name,
      i.avatar_url,
      i.metadata
    from public.integrations i
    where i.user_id = p_user_id and i.provider = p_provider;
end;
$$;

create or replace function public.delete_integration_tokens(
  p_user_id uuid,
  p_provider text
) returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_access_vault_id uuid;
  v_refresh_vault_id uuid;
begin
  select access_token_vault_id, refresh_token_vault_id
    into v_access_vault_id, v_refresh_vault_id
    from public.integrations
    where user_id = p_user_id and provider = p_provider;

  delete from public.integrations where user_id = p_user_id and provider = p_provider;

  if v_access_vault_id is not null then
    delete from vault.secrets where id = v_access_vault_id;
  end if;
  if v_refresh_vault_id is not null then
    delete from vault.secrets where id = v_refresh_vault_id;
  end if;
end;
$$;

-- A imagem supabase/postgres concede EXECUTE a anon/authenticated em toda
-- função nova do schema public por padrão (ALTER DEFAULT PRIVILEGES próprio
-- da imagem) — "revoke ... from public" sozinho NÃO desfaz isso, porque
-- PUBLIC é uma pseudo-role distinta de anon/authenticated como roles
-- nomeadas. Confirmado ao vivo: sem revogar essas duas explicitamente, um
-- usuário autenticado comum conseguia chamar upsert_integration_tokens e
-- sobrescrever o token de QUALQUER user_id — sempre revogar as três.
revoke all on function public.upsert_integration_tokens from public, anon, authenticated;
revoke all on function public.get_integration_tokens from public, anon, authenticated;
revoke all on function public.delete_integration_tokens from public, anon, authenticated;
grant execute on function public.upsert_integration_tokens to service_role;
grant execute on function public.get_integration_tokens to service_role;
grant execute on function public.delete_integration_tokens to service_role;

-- =====================================================================
-- ai_integrations — integrações de IA cadastradas pelo usuário: múltiplas
-- por driver-base (openai/gemini/claude/zai) permitidas, cada uma com seu
-- próprio nome, URL base, modelo, prompt de sistema e parâmetros de
-- geração (temperatura, limite de tokens, penalidades). Mesmo padrão de
-- integrations acima: chave nunca em texto plano (só o id do secret no
-- Vault), acesso exclusivo via função SECURITY DEFINER + service_role.
-- Tabela própria, não reaproveita integrations (que tem colunas de OAuth
-- que não fazem sentido aqui). Substitui a antiga ai_provider_keys (uma
-- linha por usuário+provider, sem esses parâmetros). Ambientes já
-- inicializados antes desta tabela existir aplicam a mesma DDL via
-- supabase/volumes/db/manual/10_ai_integrations.sql (que também migra os
-- dados de ai_provider_keys).
-- =====================================================================
create table public.ai_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Driver/protocolo — qual dos módulos em src/lib/aiProviders/ sabe falar
  -- com essa integração. Múltiplas integrações do MESMO driver (ex.: duas
  -- 'openai' com base_url/api_key diferentes, apontando pra um serviço
  -- OpenAI-compatible de terceiro) não exigem nenhuma mudança de código.
  provider text not null check (provider in ('openai', 'gemini', 'claude', 'zai')),
  -- Rótulo do próprio usuário — diferencia duas integrações do mesmo
  -- provider nos seletores da UI.
  name text not null,
  api_key_vault_id uuid,
  -- null = usa o host hardcoded do driver.
  base_url text,
  -- null = usa o defaultModel do driver.
  model text,
  system_prompt text,
  -- 'append' (default) acrescenta depois do prompt padrão da capacidade +
  -- prompt customizado global (public.custom_prompts) já resolvidos;
  -- 'replace' substitui tudo. Ver src/lib/promptResolution.js.
  system_prompt_mode text not null default 'append' check (system_prompt_mode in ('append', 'replace')),
  temperature numeric(3, 2) not null default 0.7 check (temperature between 0 and 1),
  max_tokens integer check (max_tokens is null or max_tokens > 0),
  -- Sem efeito nos drivers Claude e Z.ai (as APIs não expõem esses
  -- parâmetros) — aceitos aqui por uniformidade do formulário/schema.
  presence_penalty numeric(3, 2) check (presence_penalty between -2 and 2),
  frequency_penalty numeric(3, 2) check (frequency_penalty between -2 and 2),
  -- Uma integração padrão por usuário, pré-selecionada nos seletores das
  -- telas de geração (ver índice único parcial abaixo).
  is_default boolean not null default false,
  -- Desativa temporariamente sem apagar a config — some dos seletores.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create unique index ai_integrations_one_default_per_user
  on public.ai_integrations (user_id) where is_default;
create index ai_integrations_user_id_idx on public.ai_integrations (user_id);

-- Sem trigger set_updated_at (diferente de shortcuts/custom_prompts/etc.)
-- — toda escrita passa pelas RPCs abaixo, que já setam updated_at = now()
-- explicitamente onde importa, mesmo padrão da antiga ai_provider_keys.

create or replace function public.create_ai_integration(
  p_user_id uuid,
  p_provider text,
  p_name text,
  p_api_key text,
  p_base_url text,
  p_model text,
  p_system_prompt text,
  p_system_prompt_mode text,
  p_temperature numeric,
  p_max_tokens integer,
  p_presence_penalty numeric,
  p_frequency_penalty numeric,
  p_is_default boolean
) returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
  v_vault_id uuid;
begin
  v_vault_id := vault.create_secret(p_api_key, p_user_id::text || ':' || p_provider || ':' || gen_random_uuid());

  if p_is_default then
    update public.ai_integrations set is_default = false where user_id = p_user_id and is_default;
  end if;

  insert into public.ai_integrations (
    user_id, provider, name, api_key_vault_id, base_url, model,
    system_prompt, system_prompt_mode, temperature, max_tokens,
    presence_penalty, frequency_penalty, is_default
  )
  values (
    p_user_id, p_provider, p_name, v_vault_id, p_base_url, p_model,
    p_system_prompt, coalesce(p_system_prompt_mode, 'append'), coalesce(p_temperature, 0.7), p_max_tokens,
    p_presence_penalty, p_frequency_penalty, coalesce(p_is_default, false)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_ai_integration(
  p_user_id uuid,
  p_integration_id uuid,
  p_name text,
  p_api_key text, -- null = mantém a chave atual
  p_base_url text,
  p_model text,
  p_system_prompt text,
  p_system_prompt_mode text,
  p_temperature numeric,
  p_max_tokens integer,
  p_presence_penalty numeric,
  p_frequency_penalty numeric,
  p_is_default boolean, -- null = não mexe; true = vira a padrão
  p_is_active boolean -- null = não mexe
) returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_vault_id uuid;
  v_row_count integer;
begin
  select api_key_vault_id into v_vault_id
    from public.ai_integrations
    where id = p_integration_id and user_id = p_user_id;

  if v_vault_id is null and p_api_key is not null then
    return false;
  end if;

  if p_api_key is not null then
    perform vault.update_secret(v_vault_id, p_api_key);
  end if;

  if p_is_default then
    update public.ai_integrations set is_default = false where user_id = p_user_id and is_default;
  end if;

  update public.ai_integrations set
    name = coalesce(p_name, name),
    base_url = p_base_url,
    model = p_model,
    system_prompt = p_system_prompt,
    system_prompt_mode = coalesce(p_system_prompt_mode, system_prompt_mode),
    temperature = coalesce(p_temperature, temperature),
    max_tokens = p_max_tokens,
    presence_penalty = p_presence_penalty,
    frequency_penalty = p_frequency_penalty,
    is_default = coalesce(p_is_default, is_default),
    is_active = coalesce(p_is_active, is_active),
    updated_at = now()
  where id = p_integration_id and user_id = p_user_id;

  get diagnostics v_row_count = row_count;
  return v_row_count > 0;
end;
$$;

create or replace function public.delete_ai_integration(
  p_user_id uuid,
  p_integration_id uuid
) returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_vault_id uuid;
begin
  select api_key_vault_id into v_vault_id
    from public.ai_integrations
    where id = p_integration_id and user_id = p_user_id;

  delete from public.ai_integrations where id = p_integration_id and user_id = p_user_id;

  if v_vault_id is not null then
    delete from vault.secrets where id = v_vault_id;
  end if;
end;
$$;

create or replace function public.get_ai_integration(
  p_user_id uuid,
  p_integration_id uuid
) returns table (
  api_key text,
  provider text,
  base_url text,
  model text,
  system_prompt text,
  system_prompt_mode text,
  temperature numeric,
  max_tokens integer,
  presence_penalty numeric,
  frequency_penalty numeric
)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return query
    select
      (select decrypted_secret from vault.decrypted_secrets where id = i.api_key_vault_id),
      i.provider, i.base_url, i.model, i.system_prompt, i.system_prompt_mode,
      i.temperature, i.max_tokens, i.presence_penalty, i.frequency_penalty
    from public.ai_integrations i
    where i.id = p_integration_id and i.user_id = p_user_id and i.is_active;
end;
$$;

create or replace function public.list_ai_integrations(
  p_user_id uuid
) returns table (
  id uuid,
  provider text,
  name text,
  has_api_key boolean,
  base_url text,
  model text,
  system_prompt text,
  system_prompt_mode text,
  temperature numeric,
  max_tokens integer,
  presence_penalty numeric,
  frequency_penalty numeric,
  is_default boolean,
  is_active boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    i.id, i.provider, i.name, i.api_key_vault_id is not null, i.base_url, i.model,
    i.system_prompt, i.system_prompt_mode, i.temperature, i.max_tokens,
    i.presence_penalty, i.frequency_penalty, i.is_default, i.is_active, i.created_at
  from public.ai_integrations i
  where i.user_id = p_user_id
  order by i.is_default desc, i.name asc;
$$;

revoke all on function public.create_ai_integration from public, anon, authenticated;
revoke all on function public.update_ai_integration from public, anon, authenticated;
revoke all on function public.delete_ai_integration from public, anon, authenticated;
revoke all on function public.get_ai_integration from public, anon, authenticated;
revoke all on function public.list_ai_integrations from public, anon, authenticated;
grant execute on function public.create_ai_integration to service_role;
grant execute on function public.update_ai_integration to service_role;
grant execute on function public.delete_ai_integration to service_role;
grant execute on function public.get_ai_integration to service_role;
grant execute on function public.list_ai_integrations to service_role;

-- =====================================================================
-- shortcuts / custom_prompts / course_notes — antes só existiam no
-- IndexedDB do navegador, sincronizados via Google Drive (agora removido
-- por completo, ver plano). Sem soft-delete: nenhum dos três tinha conceito
-- de tombstone/merge multi-dispositivo mesmo no modelo antigo (delete
-- físico de verdade em shortcuts; prompts/notas só se sobrescrevem, nunca
-- são removidos).
-- =====================================================================
create table public.shortcuts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,
  url text not null,
  icon text not null default 'link',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shortcuts_user_id_idx on public.shortcuts (user_id);

-- Um prompt customizado por capability de IA por usuário — mesmas 3
-- capabilities de src/lib/customPrompts.js's CAPABILITIES.
create table public.custom_prompts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  capability text not null check (capability in ('generateQuestions', 'suggestReply', 'improveMessage')),
  text text not null,
  mode text not null default 'append' check (mode in ('append', 'replace')),
  updated_at timestamptz not null default now(),
  primary key (user_id, capability)
);

-- Uma anotação por curso por usuário — course_code é o código legível do
-- Canvas (não o id numérico), mesma convenção do modelo antigo.
create table public.course_notes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_code text not null,
  course_id text,
  text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_code)
);

-- Vínculo curso-do-Canvas <-> workspace — cursos não são uma linha em
-- `projects`, então não têm onde guardar um workspace_id como projeto tem;
-- esta é a versão mínima do que seria `external_references` (Fase 2) só
-- pra isto. No máximo um workspace por curso por usuário, mesma regra "1:N
-- direto" de projects.workspace_id (não N:N solto).
create table public.course_workspace_links (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create index course_workspace_links_workspace_id_idx on public.course_workspace_links (workspace_id);

-- =====================================================================
-- ui_preferences — tema, densidade de card, visão padrão de Tarefas,
-- agrupamento por projeto, colunas do Kanban fechadas, workspace ativo,
-- sidebar colapsada. Migrado do localStorage/sessionStorage (uma linha por
-- usuário, não um histórico — user_id é a própria PK). Não é secreto — RLS
-- igual a workspaces/projects/tasks, sem o isolamento service-role-only de
-- integrations/ai_provider_keys. Ambientes já inicializados antes desta
-- tabela existir aplicam a mesma DDL via
-- supabase/volumes/db/manual/09_ui_preferences.sql.
-- =====================================================================
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

-- ---------------------------------------------------------------------
-- updated_at automático — sem isto, a coluna fica congelada no valor do
-- INSERT pra sempre (o default só se aplica na criação), quebrando a lógica
-- de "o mais recente vence" que recordMerge.js's mergeRecords depende
-- (comparação simples por updatedAt). Trigger em vez de setar isso a mão em
-- cada função do repo — garante a correção mesmo pra escritas que não
-- passem pela camada JS (psql direto, PostgREST cru).
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.shortcuts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.custom_prompts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.course_notes
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.ui_preferences
  for each row execute function public.set_updated_at();
