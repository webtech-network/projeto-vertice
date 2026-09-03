-- Publicação do Realtime — só tasks/projects/workspaces, nunca integrations
-- (nem precisaria: sem policy pra authenticated, o Realtime não teria nada
-- pra devolver de qualquer forma, já que ele avalia RLS por assinante).
--
-- Tratado como stretch/prova de conceito na Fase 1, não como corte completo
-- — ver seção "Fases seguintes" do plano: desligar de vez o sync via Google
-- Drive (tasksDriveSync/workspacesDriveSync) só depois que a migração
-- automática IndexedDB -> Postgres existir.
alter publication supabase_realtime add table public.tasks, public.projects, public.workspaces;
