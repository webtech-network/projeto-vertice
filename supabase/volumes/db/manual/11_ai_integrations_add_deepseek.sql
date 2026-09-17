-- Adds the 'deepseek' driver (src/lib/aiProviders/deepseek.js) to
-- public.ai_integrations.provider's check constraint. Manual because this
-- table already exists on any environment that ran 10_ai_integrations.sql —
-- the same widened list was also applied directly to
-- volumes/db/init/04_schema.sql so a fresh install has it from the start.
--
-- Rode:
--   docker compose exec -T db psql -U postgres -d postgres < volumes/db/manual/11_ai_integrations_add_deepseek.sql

alter table public.ai_integrations drop constraint ai_integrations_provider_check;
alter table public.ai_integrations
  add constraint ai_integrations_provider_check check (provider in ('openai', 'gemini', 'claude', 'zai', 'deepseek'));
