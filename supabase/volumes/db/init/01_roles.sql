-- Vendorizado de github.com/supabase/supabase/blob/master/docker/volumes/db/roles.sql
-- Alinha a senha dos papéis internos que o GoTrue/PostgREST usam para
-- conectar no Postgres com POSTGRES_PASSWORD (a imagem supabase/postgres já
-- cria esses papéis no bootstrap; aqui só setamos a senha real).
--
-- NOTE: troque para senhas próprias em produção.
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
