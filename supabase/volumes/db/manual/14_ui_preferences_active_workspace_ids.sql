-- Seleção múltipla de workspaces ativos (ADR-0021): lista de ids em
-- ui_preferences, ao lado de active_workspace_id (que continua guardando o
-- primeiro/primário por compatibilidade — dispositivos/builds anteriores
-- seguem lendo só ele). Vazio/NULL = Base (sem filtro).
--
-- Sem FK por elemento (Postgres não suporta FK em array); ids de workspaces
-- apagados são descartados no cliente (WorkspaceScopeProvider.jsx).
--
-- Arquivo manual porque este banco já foi inicializado — a mesma coluna
-- também foi adicionada a volumes/db/init/04_schema.sql pra instalações novas.
--
-- Rode (a partir de supabase/) depois que os 5 serviços estiverem saudáveis. Use
-- `-U supabase_admin`, não `postgres`: a tabela ui_preferences pertence ao
-- supabase_admin e, com `postgres`, o ALTER falha com "must be owner of table":
--   docker compose exec -T db psql -U supabase_admin -d postgres < volumes/db/manual/14_ui_preferences_active_workspace_ids.sql
--   docker compose exec -T db psql -U postgres -d postgres -c "notify pgrst, 'reload schema'"
--
-- Opcional: sem esta migração o app não quebra — a seleção múltipla só vale neste
-- navegador e apenas o workspace primário sincroniza entre dispositivos.

alter table public.ui_preferences
  add column if not exists active_workspace_ids uuid[] not null default '{}';
