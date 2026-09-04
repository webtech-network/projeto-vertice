'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getCustomPrompt } from '@/lib/customPrompts';

// Unlike MessageList's "Sugerir resposta com IA" (which opens a Modal with a
// brand-new piece of text for a different box), this improves the
// professor's own in-progress draft — so the AI result replaces the
// textarea content in place instead of surfacing in a separate dialog.
export default function ComposeMessage({ courseId, integrations = [] }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [integrationId, setIntegrationId] = useState(
    integrations.find((i) => i.isDefault)?.id || integrations[0]?.id || '',
  );
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [result, setResult] = useState(null); // { recipientCount, failedBatches } | null

  async function handleImprove() {
    if (!body.trim()) return;
    setImproving(true);
    setImproveError(null);
    try {
      const custom = await getCustomPrompt('improveMessage');
      const response = await fetch(`/api/ai/integrations/${integrationId}/improve-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body, customPromptText: custom?.text, customPromptMode: custom?.mode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao melhorar a mensagem.');
      setBody(data.improved);
    } catch (err) {
      setImproveError(err.message);
    } finally {
      setImproving(false);
    }
  }

  async function handleSend() {
    if (!body.trim()) return;
    if (
      !window.confirm(
        'Enviar esta mensagem para todos os alunos ativos deste curso? Cada aluno recebe uma cópia individual e privada.',
      )
    ) {
      return;
    }

    setSending(true);
    setSendError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/canvas/courses/${courseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao enviar a mensagem.');
      setResult({ recipientCount: data.recipientCount, failedBatches: data.failedBatches });
      setSubject('');
      setBody('');
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <div className="compose-message-toggle">
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          Nova mensagem
        </button>
      </div>
    );
  }

  return (
    <div className="compose-message">
      <div className="compose-message-header">
        <h2>Nova mensagem</h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>

      <p className="lede">Envia uma cópia individual e privada desta mensagem para cada aluno ativo do curso.</p>

      <label className="compose-message-field">
        <span>Assunto (opcional)</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Assunto da mensagem"
        />
      </label>

      <label className="compose-message-field">
        <span>Mensagem</span>
        <textarea
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva a mensagem para os alunos…"
        />
      </label>

      {integrations.length === 0 ? (
        <p className="lede">
          Configure uma integração de IA em <Link href="/perfil">seu perfil</Link> para melhorar a mensagem com IA.
        </p>
      ) : (
        <div className="compose-message-actions">
          {integrations.length > 1 && (
            <select
              aria-label="Integração de IA"
              value={integrationId}
              onChange={(e) => setIntegrationId(e.target.value)}
            >
              {integrations.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {i.providerLabel} ({i.model})
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={improving || !body.trim()}
            onClick={handleImprove}
          >
            {improving ? 'Melhorando…' : 'Melhorar com IA'}
          </button>
        </div>
      )}

      {improveError && (
        <p className="alert alert-error" role="alert">
          {improveError}
        </p>
      )}

      <div className="compose-message-actions">
        <button type="button" className="btn btn-primary" disabled={sending || !body.trim()} onClick={handleSend}>
          {sending ? 'Enviando…' : 'Enviar aos alunos'}
        </button>
      </div>

      {sendError && (
        <p className="alert alert-error" role="alert">
          {sendError}
        </p>
      )}

      {result && (
        <p className="alert alert-success" role="status">
          Mensagem enviada para {result.recipientCount} aluno{result.recipientCount === 1 ? '' : 's'}.
          {result.failedBatches > 0 && ' Alguns lotes falharam — tente reenviar se necessário.'}
        </p>
      )}
    </div>
  );
}
