'use client';

import { useEffect, useState } from 'react';
import { Fingerprint, Pencil, Trash2, Plus } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';
import { describePasskeyError } from '@/lib/passkeys';

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

function formatDate(iso) {
  if (!iso) return null;
  try {
    return DATE_FORMATTER.format(new Date(iso));
  } catch {
    return null;
  }
}

// Cadastro/gerenciamento de passkeys em /perfil, atrás da mesma flag
// NEXT_PUBLIC_PASSKEYS_ENABLED que libera o botão "Entrar com passkey" em
// LoginButtons.jsx. Sempre requer sessão ativa (registerPasskey/passkey.*
// exigem `auth.experimental.passkey: true` + usuário logado — só faz
// sentido aqui, já atrás do gate de login da página).
export default function PasskeyManager() {
  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  async function refresh() {
    const supabase = createSupabaseBrowserClient();
    const { data, error: listError } = await supabase.auth.passkey.list();
    if (listError) {
      setError(describePasskeyError(listError));
      return;
    }
    setPasskeys(data || []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRegister() {
    setRegistering(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: registerError } = await supabase.auth.registerPasskey();
      if (registerError || !data) {
        setError(describePasskeyError(registerError));
        return;
      }
      const friendlyName = window.prompt('Nome para identificar esta passkey (opcional):', '');
      if (friendlyName && friendlyName.trim()) {
        const { error: updateError } = await supabase.auth.passkey.update({
          passkeyId: data.id,
          friendlyName: friendlyName.trim(),
        });
        if (updateError) setError(describePasskeyError(updateError));
      }
      await refresh();
    } catch (err) {
      setError(describePasskeyError(err));
    } finally {
      setRegistering(false);
    }
  }

  async function handleRename(passkey) {
    const friendlyName = window.prompt('Novo nome para esta passkey:', passkey.friendly_name || '');
    if (friendlyName === null || !friendlyName.trim()) return;
    setBusyId(passkey.id);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.passkey.update({
        passkeyId: passkey.id,
        friendlyName: friendlyName.trim(),
      });
      if (updateError) {
        setError(describePasskeyError(updateError));
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(passkey) {
    if (!window.confirm(`Remover a passkey "${passkey.friendly_name || 'sem nome'}"?`)) return;
    setBusyId(passkey.id);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: deleteError } = await supabase.auth.passkey.delete({ passkeyId: passkey.id });
      if (deleteError) {
        setError(describePasskeyError(deleteError));
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="shortcuts-manager">
      <div className="shortcuts-manager-header">
        <button type="button" className="btn btn-primary btn-sm" disabled={registering} onClick={handleRegister}>
          <Plus size={15} strokeWidth={1.8} />
          {registering ? 'Aguardando dispositivo…' : 'Adicionar passkey'}
        </button>
      </div>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="lede">Carregando…</p>
      ) : passkeys.length === 0 ? (
        <p className="lede">Nenhuma passkey cadastrada ainda.</p>
      ) : (
        <ul className="shortcuts-list">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="shortcuts-list-item">
              <div className="shortcuts-list-item-main">
                <Fingerprint size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>
                  <span className="card-title">{passkey.friendly_name || 'Passkey sem nome'}</span>
                  <span className="card-meta">
                    Criada em {formatDate(passkey.created_at) || '—'}
                    {passkey.last_used_at ? ` · Último uso em ${formatDate(passkey.last_used_at)}` : ''}
                  </span>
                </span>
              </div>
              <div className="shortcuts-list-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-icon btn-sm"
                  title="Renomear passkey"
                  aria-label={`Renomear passkey ${passkey.friendly_name || ''}`}
                  disabled={busyId === passkey.id}
                  onClick={() => handleRename(passkey)}
                >
                  <Pencil size={14} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-icon btn-sm"
                  title="Remover passkey"
                  aria-label={`Remover passkey ${passkey.friendly_name || ''}`}
                  disabled={busyId === passkey.id}
                  onClick={() => handleDelete(passkey)}
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
