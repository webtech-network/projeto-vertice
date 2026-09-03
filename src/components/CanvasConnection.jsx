'use client';

import { useEffect, useState } from 'react';
import { CircleCheck } from 'lucide-react';

// Espelha GithubConnection.jsx/GoogleConnection.jsx, mas o estado da conexão
// vive no Postgres (tabela integrations, tokens cifrados no Vault), não no
// IndexedDB do navegador — por isso busca via /api/canvas/status em vez de
// ler um store local. O handoff pós-OAuth também é mais simples: o próprio
// src/app/oauth2/callback/route.js já grava a integração antes de
// redirecionar de volta (modo "conectar" — ver o cookie canvas_connect_mode
// lá), então aqui só falta reler o status, sem passo de "resgatar uma vez".
export default function CanvasConnection() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const canvasParam = params.get('canvas');
      if (canvasParam === 'erro') {
        setError('Falha ao conectar com o Canvas. Tente novamente.');
        window.history.replaceState({}, '', window.location.pathname + '?tab=plataformas');
      } else if (canvasParam === 'connected') {
        window.history.replaceState({}, '', window.location.pathname + '?tab=plataformas');
      }

      try {
        const response = await fetch('/api/canvas/status');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Falha ao consultar a conexão com o Canvas.');
        if (!cancelled) setStatus(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const response = await fetch('/api/canvas/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error('Falha ao desconectar o Canvas.');
      setStatus({ connected: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="github-connection">
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {status?.connected ? (
        <div className="github-connection-status">
          {status.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- avatar hospedado pelo Canvas da instituição, não um asset local
            <img src={status.avatarUrl} alt="" className="github-avatar" width={40} height={40} />
          )}
          <div>
            <span className="card-title">{status.displayName || 'Conta do Canvas'}</span>
            <span className="card-meta">
              {status.baseUrl} — <CircleCheck size={14} strokeWidth={2} className="inline-icon" /> Conectado
            </span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" disabled={disconnecting} onClick={handleDisconnect}>
            {disconnecting ? 'Desconectando…' : 'Desconectar'}
          </button>
        </div>
      ) : (
        <>
          <p className="lede">
            Conecte sua conta do Canvas para habilitar cursos, atividades, mensagens e importação de questões.
          </p>
          <a href="/api/auth/login?connect=1" className="btn btn-primary">
            Conectar com Canvas
          </a>
        </>
      )}
    </div>
  );
}
