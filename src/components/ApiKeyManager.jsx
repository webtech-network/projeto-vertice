'use client';

import { useEffect, useState } from 'react';
import { CircleCheck, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';

// Shared between the Profile page (where keys are managed, one instance per
// registered provider — see src/lib/aiProviders) and QuestionGenerator
// (which only reads which providers have a key configured) — both read/write
// the same public.ai_provider_keys row (per user, per provider — see
// src/lib/aiProviderKeys.js) via this same form, so there is a single
// source of truth per provider. `onDirtyChange` (optional) reports whether
// there's typed-but-unsaved key text, so a page embedding several of these
// (ProfileTabs) can warn before the professor navigates away. `currentModel`
// is the professor's saved model override for this provider, or null if
// none — read once server-side (perfil/page.jsx) via listAiProviderKeys.
export default function ApiKeyManager({ provider, hasApiKey, currentModel, onDirtyChange }) {
  const [keyConfigured, setKeyConfigured] = useState(hasApiKey);
  const [showKeyForm, setShowKeyForm] = useState(!hasApiKey);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [model, setModel] = useState(currentModel || null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [selectedModel, setSelectedModel] = useState(currentModel || '');
  const [savingModel, setSavingModel] = useState(false);

  const isDirty = showKeyForm && apiKeyInput.trim().length > 0;
  // Deliberately depends only on `isDirty`, not `onDirtyChange` itself —
  // ProfileTabs passes a fresh inline callback each render, and including it
  // here would re-run this effect (and its parent setState) every render.
  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty]);

  async function handleSaveKey() {
    if (!apiKeyInput.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai/${provider.id}/key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Falha ao validar a chave.');
      } else {
        setKeyConfigured(true);
        setShowKeyForm(false);
        setApiKeyInput('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveKey() {
    setSaving(true);
    setError(null);
    try {
      await fetch(`/api/ai/${provider.id}/key`, { method: 'DELETE' });
      setKeyConfigured(false);
      setShowKeyForm(true);
      setModel(null);
      setSelectedModel('');
      setPickerOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePicker() {
    const opening = !pickerOpen;
    setPickerOpen(opening);
    if (opening && !availableModels && !modelsLoading) {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const response = await fetch(`/api/ai/${provider.id}/models`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Falha ao listar os modelos disponíveis.');
        setAvailableModels(data.models);
      } catch (err) {
        setModelsError(err.message);
      } finally {
        setModelsLoading(false);
      }
    }
  }

  async function handleSaveModel() {
    setSavingModel(true);
    setModelsError(null);
    try {
      if (selectedModel) {
        const response = await fetch(`/api/ai/${provider.id}/model`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: selectedModel }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Falha ao salvar o modelo.');
        setModel(selectedModel);
      } else {
        await fetch(`/api/ai/${provider.id}/model`, { method: 'DELETE' });
        setModel(null);
      }
      setPickerOpen(false);
    } catch (err) {
      setModelsError(err.message);
    } finally {
      setSavingModel(false);
    }
  }

  return (
    <div className="api-key-manager">
      <h3>{provider.label}</h3>

      {!keyConfigured || showKeyForm ? (
        <div className="ai-key-form">
          <label htmlFor={`${provider.id}-key`}>Chave de API</label>
          <input
            id={`${provider.id}-key`}
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="sk-..."
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !apiKeyInput.trim()}
            onClick={handleSaveKey}
          >
            {saving ? 'Validando…' : 'Salvar e validar chave'}
          </button>
          {keyConfigured && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowKeyForm(false)}>
              Cancelar
            </button>
          )}
          {error && <div className="alert alert-error">{error}</div>}
        </div>
      ) : (
        <>
          <div className="ai-key-status">
            <span>
              Chave configurada <CircleCheck size={14} strokeWidth={2} className="inline-icon" />
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              title="Trocar chave"
              aria-label="Trocar chave"
              onClick={() => setShowKeyForm(true)}
            >
              <Pencil size={16} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              title="Remover chave"
              aria-label="Remover chave"
              disabled={saving}
              onClick={handleRemoveKey}
            >
              <Trash2 size={16} strokeWidth={1.8} />
            </button>
          </div>

          <div className="ai-model-picker">
            <span className="card-meta">
              Modelo: <strong>{model || `${provider.defaultModel} (padrão)`}</strong>
            </span>
            <button type="button" className="alert-toggle" onClick={togglePicker}>
              {pickerOpen ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
              Trocar modelo
            </button>

            {pickerOpen && (
              <div className="ai-model-picker-panel">
                {modelsLoading && <p className="lede">Carregando modelos disponíveis…</p>}
                {modelsError && (
                  <p className="alert alert-error" role="alert">
                    {modelsError}
                  </p>
                )}
                {availableModels && (
                  <>
                    <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                      <option value="">Usar modelo padrão ({provider.defaultModel})</option>
                      {availableModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={savingModel}
                      onClick={handleSaveModel}
                    >
                      {savingModel ? 'Salvando…' : 'Salvar modelo'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
