-- Vendorizado de github.com/supabase/supabase/blob/master/docker/volumes/db/realtime.sql
-- O container do Realtime roda sua própria migração de schema na subida, mas
-- precisa que o schema _realtime já exista e pertença ao usuário certo.
\set pguser `echo "$POSTGRES_USER"`

create schema if not exists _realtime;
alter schema _realtime owner to :pguser;
