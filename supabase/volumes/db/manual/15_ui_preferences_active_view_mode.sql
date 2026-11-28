-- Migração manual: adiciona a coluna active_view_mode na tabela
-- public.ui_preferences para sincronizar a visão ativa (Professor vs. Aluno)
-- entre dispositivos (ADR-0027).
--
-- Como aplicar em ambientes já provisionados:
--   docker compose exec -T db psql -U supabase_admin -d postgres < volumes/db/manual/15_ui_preferences_active_view_mode.sql

alter table public.ui_preferences
  add column if not exists active_view_mode text
  check (active_view_mode in ('teacher', 'student'));
