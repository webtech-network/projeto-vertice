-- Migra as chaves de API de IA (openai/gemini/claude) + modelo escolhido do
-- iron-session (session.aiApiKeys/session.aiModels) pro Postgres — mesmo
-- padrão já usado por public.integrations (04_schema.sql): a chave nunca
-- fica em texto plano, só o id do secret no Vault; acesso exclusivo via
-- funções SECURITY DEFINER chamadas só por service_role.
--
-- Tabela própria, não reaproveita integrations — aquela tem colunas
-- específicas de OAuth (provider_user_id/avatar_url/scopes/refresh_token)
-- que não fazem sentido pra uma chave de API pura.
--
-- Arquivo manual porque este banco já foi inicializado (init scripts só
-- rodam uma vez, na criação do volume) — a mesma DDL também foi adicionada a
-- volumes/db/init/04_schema.sql e volumes/db/init/05_rls.sql pra instalações
-- novas terem isso de cara, sem precisar deste passo manual.
--
-- Rode depois que os 5 serviços estiverem saudáveis:
--   docker compose exec -T db psql -U postgres -d postgres < volumes/db/manual/08_ai_provider_keys.sql

create table public.ai_provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'gemini', 'claude')),
  api_key_vault_id uuid not null,
  -- Preferência de modelo do usuário pra este provedor — não é segredo, não
  -- vai pro Vault. Fica na mesma linha da chave (não numa tabela separada)
  -- de propósito: a UI (ApiKeyManager.jsx) só permite escolher um modelo
  -- depois que uma chave já existe, então "excluir a chave" já limpa o
  -- modelo junto (a linha inteira some) sem precisar de um segundo passo.
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index ai_provider_keys_user_id_idx on public.ai_provider_keys (user_id);

alter table public.ai_provider_keys enable row level security;
-- Zero policies pra anon/authenticated, de propósito — mesma postura de
-- public.integrations. Único acesso é via service_role, sempre a partir de
-- rotas server-side do Next.js (src/lib/aiProviderKeys.js).

create or replace function public.upsert_ai_provider_key(
  p_user_id uuid,
  p_provider text,
  p_api_key text
) returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
  v_vault_id uuid;
begin
  select id, api_key_vault_id into v_id, v_vault_id
    from public.ai_provider_keys
    where user_id = p_user_id and provider = p_provider;

  if v_vault_id is not null then
    perform vault.update_secret(v_vault_id, p_api_key);
  else
    v_vault_id := vault.create_secret(p_api_key, p_user_id::text || ':' || p_provider || ':' || gen_random_uuid());
  end if;

  -- Reinserir/atualizar a chave nunca mexe em `model` — só delete_ai_provider_key
  -- limpa o modelo (junto com a linha inteira).
  insert into public.ai_provider_keys (user_id, provider, api_key_vault_id, updated_at)
  values (p_user_id, p_provider, v_vault_id, now())
  on conflict (user_id, provider) do update set
    api_key_vault_id = excluded.api_key_vault_id,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_ai_provider_key(
  p_user_id uuid,
  p_provider text
) returns table (api_key text, model text)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return query
    select
      (select decrypted_secret from vault.decrypted_secrets where id = k.api_key_vault_id),
      k.model
    from public.ai_provider_keys k
    where k.user_id = p_user_id and k.provider = p_provider;
end;
$$;

create or replace function public.delete_ai_provider_key(
  p_user_id uuid,
  p_provider text
) returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_vault_id uuid;
begin
  select api_key_vault_id into v_vault_id
    from public.ai_provider_keys
    where user_id = p_user_id and provider = p_provider;

  delete from public.ai_provider_keys where user_id = p_user_id and provider = p_provider;

  if v_vault_id is not null then
    delete from vault.secrets where id = v_vault_id;
  end if;
end;
$$;

-- Retorna false quando não há chave configurada pra esse provedor — a rota
-- chamadora (model/route.js) trata isso como erro. p_model = null limpa a
-- preferência (volta pro default do provedor).
create or replace function public.set_ai_provider_model(
  p_user_id uuid,
  p_provider text,
  p_model text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count integer;
begin
  update public.ai_provider_keys
    set model = p_model, updated_at = now()
    where user_id = p_user_id and provider = p_provider;
  get diagnostics v_row_count = row_count;
  return v_row_count > 0;
end;
$$;

create or replace function public.list_ai_provider_keys(
  p_user_id uuid
) returns table (provider text, model text)
language sql
security definer
set search_path = public
as $$
  select k.provider, k.model from public.ai_provider_keys k where k.user_id = p_user_id;
$$;

revoke all on function public.upsert_ai_provider_key from public, anon, authenticated;
revoke all on function public.get_ai_provider_key from public, anon, authenticated;
revoke all on function public.delete_ai_provider_key from public, anon, authenticated;
revoke all on function public.set_ai_provider_model from public, anon, authenticated;
revoke all on function public.list_ai_provider_keys from public, anon, authenticated;
grant execute on function public.upsert_ai_provider_key to service_role;
grant execute on function public.get_ai_provider_key to service_role;
grant execute on function public.delete_ai_provider_key to service_role;
grant execute on function public.set_ai_provider_model to service_role;
grant execute on function public.list_ai_provider_keys to service_role;
