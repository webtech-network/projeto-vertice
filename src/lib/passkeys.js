/**
 * Feature flag + helpers compartilhados entre LoginButtons.jsx (entrar com
 * passkey) e PasskeyManager.jsx (cadastrar/gerenciar em /perfil). A API real
 * (`supabase.auth.signInWithPasskey`/`registerPasskey`/`passkey.*`) só existe
 * quando o client é criado com `auth.experimental.passkey: true` — ver
 * supabaseBrowserClient.js — e essa flag do client precisa nascer do mesmo
 * NEXT_PUBLIC_PASSKEYS_ENABLED lido aqui, senão os dois lados divergem.
 */
export const PASSKEYS_ENABLED = process.env.NEXT_PUBLIC_PASSKEYS_ENABLED === 'true';

// WebAuthn é a API do navegador que a ceremony do supabase-js chama por
// baixo (navigator.credentials.create/get) — sem isso, signInWithPasskey()/
// registerPasskey() já retornam um erro tratado, mas checar antes evita
// mostrar o botão num navegador que nunca vai conseguir completar o fluxo.
export function isPasskeySupported() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';
}

// As duas chamadas de alto nível do supabase-js (signInWithPasskey/
// registerPasskey) devolvem `{ data, error }` em vez de lançar — `error`
// pode ser um WebAuthnError (ceremony do navegador falhou/foi cancelada,
// identificado por `.name`, o nome do DOMException original) ou um AuthError
// comum (falha ao falar com o GoTrue). Ver node_modules/@supabase/auth-js
// lib/webauthn.errors.js para o catálogo completo de nomes possíveis.
export function describePasskeyError(error) {
  if (!error) return 'Ocorreu um erro inesperado com a passkey.';
  if (error.name === 'NotAllowedError') {
    return 'Operação cancelada ou tempo esgotado antes de confirmar a passkey.';
  }
  if (error.name === 'InvalidStateError') {
    return 'Este dispositivo/autenticador já está cadastrado como passkey.';
  }
  if (error.name === 'AuthSessionMissingError') {
    return 'Sua sessão expirou. Atualize a página e tente novamente.';
  }
  if (error.message === 'Browser does not support WebAuthn') {
    return 'Este navegador não tem suporte a passkeys.';
  }
  return error.message || 'Ocorreu um erro inesperado com a passkey.';
}
