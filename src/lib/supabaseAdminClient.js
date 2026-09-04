import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerUrl } from '@/lib/supabaseUrl';

/**
 * Client Supabase com a SERVICE_ROLE_KEY — ignora RLS por definição.
 *
 * SÓ pode ser importado por código server-only (Route Handlers, o bridge de
 * callback OAuth do Canvas se a Opção B for necessária, funções chamadas a
 * partir deles). NUNCA importar isso de um Client Component ('use client')
 * ou de qualquer módulo que possa acabar num bundle enviado ao browser — é
 * o único jeito de vazar acesso irrestrito ao banco inteiro.
 *
 * É este client (via `.rpc(...)`) que chama
 * `public.upsert_integration_tokens` / `public.get_integration_tokens`
 * (ver supabase/volumes/db/init/04_schema.sql) para ler/escrever os tokens
 * de Canvas/GitHub/Google guardados cifrados no Vault — nunca lendo/
 * escrevendo a tabela `integrations` diretamente por fora dessas funções.
 */
export function createSupabaseAdminClient() {
  return createClient(
    getSupabaseServerUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
