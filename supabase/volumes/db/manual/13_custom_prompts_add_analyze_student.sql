-- Adds the 'analyzeStudent' capability (src/lib/aiProviders/studentAnalysisPrompt.js)
-- to public.custom_prompts.capability's check constraint. Manual because this
-- table already exists on any environment that ran the init schema — the same
-- widened list was also applied directly to
-- volumes/db/init/04_schema.sql so a fresh install has it from the start.
--
-- Rode:
--   docker compose exec -T db psql -U postgres -d postgres < volumes/db/manual/13_custom_prompts_add_analyze_student.sql

alter table public.custom_prompts drop constraint custom_prompts_capability_check;
alter table public.custom_prompts
  add constraint custom_prompts_capability_check check (capability in ('generateQuestions', 'suggestReply', 'improveMessage', 'analyzeStudent'));
