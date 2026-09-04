-- Extensão da publicação do Realtime (ver 06_realtime_publication.sql) para
-- as tabelas que migraram do IndexedDB pro Postgres depois da Fase 1 e ainda
-- não tinham assinante nenhum: shortcuts, custom_prompts, course_notes, e
-- course_workspace_links (companheiro de workspaces, mesmo WorkspaceScopeProvider).
-- Nunca integrations, pelo mesmo motivo do arquivo anterior.
--
-- Arquivo separado porque "alter publication ... add table" falha se a
-- tabela já for membro — 06_realtime_publication.sql já rodou manualmente
-- (tasks/projects/workspaces). Rode depois que os 5 serviços estiverem
-- saudáveis:
--
--   docker compose exec -T db psql -U postgres -d postgres < volumes/db/manual/07_realtime_publication_v2.sql
alter publication supabase_realtime add table
  public.course_workspace_links,
  public.shortcuts,
  public.custom_prompts,
  public.course_notes;
