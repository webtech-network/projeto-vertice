'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wand2, Send } from 'lucide-react';
import { getCustomPrompt } from '@/lib/customPrompts';
import Modal from './Modal';

// Single-student sibling of ComposeMessage.jsx (which sends to every active
// student in the course) — opened from StudentReport.jsx's "Enviar mensagem
// com IA" action. Uses the same capability ComposeMessage.jsx already uses
// (improveMessage, not MessageList.jsx's suggestReply) because there's no
// original message being replied to here, just a fresh draft the professor
// is writing — improveMessage's job is exactly "polish what's already
// typed," with no reply framing to invent. `preventBackdropClose` (see
// Modal.jsx) guards the draft the same way MessageList.jsx's AI reply modal
// does, once there's text worth losing.
export default function StudentMessageModal({ student, courseId, integrations = [], onClose }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [integrationId, setIntegrationId] = useState(
    integrations.find((i) => i.isDefault)?.id || integrations[0]?.id || '',
  );
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sent, setSent] = useState(false);

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
      setSent(false);
    } catch (err) {
      setImproveError(err.message);
    } finally {
      setImproving(false);
    }
  }

  async function handleSend() {
    if (!body.trim()) return;
    if (!window.confirm(`Enviar esta mensagem para ${student.name}?`)) return;

    setSending(true);
    setSendError(null);
    try {
      const response = await fetch(`/api/canvas/courses/${courseId}/students/${student.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao enviar a mensagem.');
      setSent(true);
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title={`Mensagem para ${student.name}`} onClose={onClose} preventBackdropClose={Boolean(body.trim())}>
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
          onChange={(e) => {
            setBody(e.target.value);
            setSent(false);
          }}
          placeholder={`Escreva a mensagem para ${student.name}…`}
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
            <Wand2 size={15} strokeWidth={1.8} />
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
          <Send size={16} strokeWidth={1.8} />
          {sending ? 'Enviando…' : 'Enviar mensagem'}
        </button>
      </div>

      {sendError && (
        <p className="alert alert-error" role="alert">
          {sendError}
        </p>
      )}

      {sent && (
        <p className="alert alert-success" role="status">
          Mensagem enviada para {student.name}.
        </p>
      )}
    </Modal>
  );
}
