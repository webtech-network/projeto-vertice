'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CAPABILITIES, getCustomPrompt, saveCustomPrompt, clearCustomPrompt, toApp as promptToApp } from '@/lib/customPrompts';
import { resolvePrompt } from '@/lib/promptResolution';
import { useRealtimeTable } from '@/lib/realtime/useRealtimeTable';

function CapabilityEditor({ capability, onDirtyChange }) {
  const { key, label, defaultPrompt } = capability;
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [mode, setMode] = useState('append');
  // The last known-persisted values (from IndexedDB or a successful
  // save/reset) — compared against the current draft below to detect
  // unsaved edits, separately from `hasSaved` (which only tracks whether
  // *any* customization exists at all).
  const [savedText, setSavedText] = useState('');
  const [savedMode, setSavedMode] = useState('append');
  const [hasSaved, setHasSaved] = useState(false);
  const [showDefault, setShowDefault] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const custom = await getCustomPrompt(key);
      if (cancelled) return;
      if (custom) {
        setText(custom.text || '');
        setMode(custom.mode || 'append');
        setSavedText(custom.text || '');
        setSavedMode(custom.mode || 'append');
        setHasSaved(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  const isDirty = !loading && (text !== savedText || mode !== savedMode);
  // Deliberately depends only on `isDirty` — see ApiKeyManager.jsx's own
  // effect for why `onDirtyChange` itself isn't in the dependency array.
  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty]);

  // Realtime — sincronização multi-dispositivo ao vivo (Fase 2). Só aplica o
  // evento remoto quando não há edição em andamento (`!isDirty`, sempre o
  // valor do render mais recente — useRealtimeTable resincroniza os
  // handlers a cada render) — do contrário destruiria o rascunho que o
  // usuário está digitando. Se houver edição em andamento, ignora
  // silenciosamente: salvar depois sobrescreve com o texto local
  // (last-write-wins, mesma filosofia de tasksRepo.js/recordMerge.js — sem
  // merge de conflito, que não existe em lugar nenhum do app).
  useRealtimeTable('custom_prompts', {
    filter: `capability=eq.${key}`,
    onInsert: (row) => {
      if (isDirty) return;
      const custom = promptToApp(row);
      setText(custom.text || '');
      setMode(custom.mode || 'append');
      setSavedText(custom.text || '');
      setSavedMode(custom.mode || 'append');
      setHasSaved(true);
    },
    onUpdate: (row) => {
      if (isDirty) return;
      const custom = promptToApp(row);
      setText(custom.text || '');
      setMode(custom.mode || 'append');
      setSavedText(custom.text || '');
      setSavedMode(custom.mode || 'append');
      setHasSaved(true);
    },
    onDelete: () => {
      if (isDirty) return;
      setText('');
      setMode('append');
      setSavedText('');
      setSavedMode('append');
      setHasSaved(false);
    },
  });

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveCustomPrompt(key, { text: text.trim(), mode });
      setHasSaved(true);
      setSavedText(text.trim());
      setSavedMode(mode);
      setMessage('Prompt personalizado salvo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setMessage(null);
    try {
      await clearCustomPrompt(key);
      setText('');
      setMode('append');
      setSavedText('');
      setSavedMode('append');
      setHasSaved(false);
      setMessage('Restaurado ao prompt padrão.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  const preview = resolvePrompt(defaultPrompt, text, mode);

  return (
    <div className="prompt-customizer-item">
      <div className="prompt-customizer-item-header">
        <h3>{label}</h3>
        {hasSaved && <span className="badge">Personalizado</span>}
      </div>

      <button type="button" className="alert-toggle" onClick={() => setShowDefault((v) => !v)}>
        {showDefault ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
        Ver prompt padrão
      </button>
      {showDefault && <pre className="prompt-text-preview">{defaultPrompt}</pre>}

      <div className="segmented" role="group" aria-label={`Modo de customização — ${label}`}>
        <button
          type="button"
          className={`segmented-btn${mode === 'append' ? ' active' : ''}`}
          onClick={() => setMode('append')}
        >
          Complementar
        </button>
        <button
          type="button"
          className={`segmented-btn${mode === 'replace' ? ' active' : ''}`}
          onClick={() => setMode('replace')}
        >
          Substituir totalmente
        </button>
      </div>

      {mode === 'replace' && (
        <p className="alert alert-warning">
          Substituindo totalmente, você assume a responsabilidade por manter as regras estruturais do prompt padrão
          (formato, contagem de alternativas, JSON etc.) — do contrário a geração pode falhar na validação.
        </p>
      )}

      <textarea
        rows={5}
        placeholder={
          mode === 'replace'
            ? 'Escreva o prompt completo que vai substituir o padrão…'
            : 'Instruções adicionais para esta funcionalidade…'
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button type="button" className="alert-toggle" onClick={() => setShowPreview((v) => !v)}>
        {showPreview ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
        Ver prompt final que será enviado
      </button>
      {showPreview && <pre className="prompt-text-preview">{preview}</pre>}

      <div className="prompt-customizer-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={saving || !text.trim()} onClick={handleSave}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        {hasSaved && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={handleReset}>
            Restaurar padrão
          </button>
        )}
      </div>

      {message && <p className="lede">{message}</p>}
    </div>
  );
}

export default function PromptCustomizer({ onDirtyChange }) {
  const [dirtyMap, setDirtyMap] = useState({});

  function handleCapabilityDirty(key, isDirty) {
    setDirtyMap((prev) => (prev[key] === isDirty ? prev : { ...prev, [key]: isDirty }));
  }

  const anyDirty = Object.values(dirtyMap).some(Boolean);
  // Deliberately depends only on `anyDirty` — see ApiKeyManager.jsx's own
  // effect for why `onDirtyChange` itself isn't in the dependency array.
  useEffect(() => {
    onDirtyChange?.(anyDirty);
    return () => onDirtyChange?.(false);
  }, [anyDirty]);

  return (
    <div className="prompt-customizer">
      <p className="lede">
        Cada funcionalidade de IA usa um prompt padrão (a "skill" embutida no app). Você pode complementar esse
        prompt com instruções adicionais, ou substituí-lo totalmente.
      </p>
      {CAPABILITIES.map((capability) => (
        <CapabilityEditor
          key={capability.key}
          capability={capability}
          onDirtyChange={(isDirty) => handleCapabilityDirty(capability.key, isDirty)}
        />
      ))}
    </div>
  );
}
