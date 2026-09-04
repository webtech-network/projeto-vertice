-- Substitui public.ai_provider_keys (uma linha por usuário+provider) por
-- public.ai_integrations: um professor pode cadastrar várias integrações,
-- inclusive várias do mesmo provider-base (driver), cada uma com seu
-- próprio nome, URL base, modelo, prompt de sistema e parâmetros de
-- geração. Mesmo padrão de segurança de sempre: a chave nunca fica em
-- texto plano (só o id do secret no Vault), acesso exclusivo via funções
-- SECURITY DEFINER chamadas só por service_role.
--
-- Arquivo manual porque este banco já foi inicializado (init scripts só
-- rodam uma vez, na criação do volume) — a mesma DDL também foi adicionada a
-- volumes/db/init/04_schema.sql e volumes/db/init/05_rls.sql pra instalações
-- novas terem isso de cara, sem precisar deste passo manual.
--
-- Rode depois que os 5 serviços estiverem saudáveis:
--   docker compose exec -T db psql -U postgres -d postgres < volumes/db/manual/10_ai_integrations.sql

create table public.ai_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Driver/protocolo — qual dos módulos em src/lib/aiProviders/ sabe falar
  -- com essa integração. Adicionar um driver novo (protocolo de API
  -- diferente) ainda exige escrever um módulo e estender este check;
  -- múltiplas integrações do MESMO driver (ex.: duas integrações 'openai'
  -- com base_url/api_key diferentes, pra apontar pra um serviço
  -- OpenAI-compatible de terceiro) não exigem nenhuma mudança de código.
  provider text not null check (provider in ('openai', 'gemini', 'claude', 'zai')),
  -- Rótulo do próprio usuário — é o que diferencia duas integrações do
  -- mesmo provider nos seletores da UI.
  name text not null,
  api_key_vault_id uuid,
  -- null = usa o host hardcoded do driver (ver defaultModel/BASE_URL em
  -- cada módulo de src/lib/aiProviders/). Preenchido, aponta pra qualquer
  -- endpoint compatível com o protocolo do driver.
  base_url text,
  -- null = usa o defaultModel do driver.
  model text,
  system_prompt text,
  -- Como o prompt de sistema da integração se combina com o prompt padrão
  -- da capacidade + o prompt customizado global (public.custom_prompts):
  -- 'append' (default) acrescenta depois do que já foi resolvido; 'replace'
  -- substitui tudo. Ver src/lib/promptResolution.js.
  system_prompt_mode text not null default 'append' check (system_prompt_mode in ('append', 'replace')),
  temperature numeric(3, 2) not null default 0.7 check (temperature between 0 and 1),
  max_tokens integer check (max_tokens is null or max_tokens > 0),
  -- Sem efeito nos drivers Claude e Z.ai (nenhuma das duas APIs expõe esses
  -- parâmetros) — aceitos aqui por uniformidade do formulário/schema, cada
  -- adapter decide se usa.
  presence_penalty numeric(3, 2) check (presence_penalty between -2 and 2),
  frequency_penalty numeric(3, 2) check (frequency_penalty between -2 and 2),
  -- Uma integração padrão por usuário, pré-selecionada nos seletores das
  -- telas de geração — nunca mais de uma (ver índice único parcial abaixo).
  is_default boolean not null default false,
  -- Permite desativar temporariamente sem apagar a config (chave e
  -- parâmetros preservados) — integrações inativas somem dos seletores.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create unique index ai_integrations_one_default_per_user
  on public.ai_integrations (user_id) where is_default;
create index ai_integrations_user_id_idx on public.ai_integrations (user_id);

alter table public.ai_integrations enable row level security;
-- Zero policies pra anon/authenticated, de propósito — mesma postura de
-- public.integrations / public.ai_provider_keys. Único acesso é via
-- service_role, sempre a partir de rotas server-side do Next.js
-- (src/lib/aiIntegrations.js).
--
-- Sem trigger set_updated_at (diferente de shortcuts/custom_prompts/etc.)
-- — mesmo padrão do antigo ai_provider_keys: toda escrita passa pelas RPCs
-- abaixo, que já setam updated_at = now() explicitamente onde importa.

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
  p_is_default boolean, -- null = não mexe; true = vira a padrão (nunca usado pra desmarcar)
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
    return false; -- linha não existe (ou não é do usuário)
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

-- Migra os dados de ai_provider_keys: cada linha (usuário+provider) vira uma
-- integração com o nome do provider — reaproveita o mesmo api_key_vault_id
-- (o secret já existe no Vault, não precisa recriar). Só a primeira linha de
-- cada usuário (ordem alfabética por provider, arbitrária mas determinística)
-- vira is_default — um usuário podia ter chaves configuradas pra mais de um
-- provider ao mesmo tempo, e ai_integrations_one_default_per_user só permite
-- uma linha default por usuário.
insert into public.ai_integrations (user_id, provider, name, api_key_vault_id, model, is_default, is_active)
select
  user_id, provider, initcap(provider), api_key_vault_id, model,
  row_number() over (partition by user_id order by provider) = 1,
  true
from public.ai_provider_keys;

drop function public.upsert_ai_provider_key(uuid, text, text);
drop function public.get_ai_provider_key(uuid, text);
drop function public.delete_ai_provider_key(uuid, text);
drop function public.set_ai_provider_model(uuid, text, text);
drop function public.list_ai_provider_keys(uuid);
drop table public.ai_provider_keys;
