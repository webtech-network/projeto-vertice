'use client';

import { useEffect, useState } from 'react';
import { CircleCheck, ChevronDown, ChevronRight, Pencil, Trash2, Star, Plus } from 'lucide-react';

const PENALTY_FREE_PROVIDERS = new Set(['claude', 'zai']);

function emptyForm(providerId) {
  return {
    provider: providerId,
    name: '',
    apiKey: '',
    baseUrl: '',
    model: '',
    systemPrompt: '',
    systemPromptMode: 'append',
    temperature: 0.7,
    maxTokens: '',
    presencePenalty: '',
    frequencyPenalty: '',
    isDefault: false,
    isActive: true,
  };
}

function formFromIntegration(integration) {
  return {
    provider: integration.provider,
    name: integration.name,
    apiKey: '',
    baseUrl: integration.baseUrl || '',
    model: integration.model || '',
    systemPrompt: integration.systemPrompt || '',
    systemPromptMode: integration.systemPromptMode || 'append',
    temperature: integration.temperature ?? 0.7,
    maxTokens: integration.maxTokens ?? '',
    presencePenalty: integration.presencePenalty ?? '',
    frequencyPenalty: integration.frequencyPenalty ?? '',
    isDefault: integration.isDefault,
    isActive: integration.isActive,
  };
}

// Chave de API convertida pra number|null: campo em branco vira null (não
// grava/limpa o valor no PATCH), preenchido vira o número.
function numOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function IntegrationForm({ driverProviders, initial, hasApiKey, onCancel, onSubmit, submitLabel }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const driver = driverProviders.find((p) => p.id === form.provider) || driverProviders[0];
  const penaltiesSupported = !PENALTY_FREE_PROVIDERS.has(form.provider);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Nome da integração é obrigatório.');
      return;
    }
    if (!hasApiKey && !form.apiKey.trim()) {
      setError('Chave de API é obrigatória.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        provider: form.provider,
        name: form.name.trim(),
        apiKey: form.apiKey.trim() || undefined,
        baseUrl: form.baseUrl.trim() || null,
        model: form.model.trim() || null,
        systemPrompt: form.systemPrompt.trim() || null,
        systemPromptMode: form.systemPromptMode,
        temperature: Number(form.temperature),
        maxTokens: numOrNull(form.maxTokens),
        presencePenalty: penaltiesSupported ? numOrNull(form.presencePenalty) : null,
        frequencyPenalty: penaltiesSupported ? numOrNull(form.frequencyPenalty) : null,
        isDefault: form.isDefault,
        isActive: form.isActive,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="integration-form" onSubmit={handleSubmit}>
      <div className="integration-form-row">
        <label htmlFor="integration-provider">Provedor</label>
        <select
          id="integration-provider"
          value={form.provider}
          disabled={hasApiKey}
          onChange={(e) => set('provider', e.target.value)}
        >
          {driverProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="integration-form-row">
        <label htmlFor="integration-name">Nome da integração</label>
        <input
          id="integration-name"
          type="text"
          placeholder={`Ex.: ${driver?.label || 'Minha integração'}`}
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      <div className="integration-form-row">
        <label htmlFor="integration-key">{hasApiKey ? 'Trocar chave de API' : 'Chave de API'}</label>
        <input
          id="integration-key"
          type="password"
          placeholder={hasApiKey ? 'Deixe em branco para manter a chave atual' : 'sk-...'}
          value={form.apiKey}
          onChange={(e) => set('apiKey', e.target.value)}
        />
      </div>

      <div className="integration-form-row">
        <label htmlFor="integration-base-url">URL Base (opcional)</label>
        <input
          id="integration-base-url"
          type="text"
          placeholder={`Padrão do provedor — deixe em branco pra usar o host oficial`}
          value={form.baseUrl}
          onChange={(e) => set('baseUrl', e.target.value)}
        />
        <p className="field-hint">
          Aponte pra qualquer endpoint compatível com o protocolo de {driver?.label} — ex. um serviço
          OpenAI-compatible de terceiro (Groq, OpenRouter, Azure OpenAI, um servidor próprio) — sem precisar de código
          novo.
        </p>
      </div>

      <div className="integration-form-row">
        <label htmlFor="integration-model">Modelo (id)</label>
        <input
          id="integration-model"
          type="text"
          placeholder={`Padrão: ${driver?.defaultModel || ''}`}
          value={form.model}
          onChange={(e) => set('model', e.target.value)}
        />
      </div>

      <div className="integration-form-row">
        <label>Prompt de sistema (opcional)</label>
        <div className="segmented" role="group" aria-label="Modo do prompt de sistema da integração">
          <button
            type="button"
            className={`segmented-btn${form.systemPromptMode === 'append' ? ' active' : ''}`}
            onClick={() => set('systemPromptMode', 'append')}
          >
            Acrescentar
          </button>
          <button
            type="button"
            className={`segmented-btn${form.systemPromptMode === 'replace' ? ' active' : ''}`}
            onClick={() => set('systemPromptMode', 'replace')}
          >
            Substituir totalmente
          </button>
        </div>
        <textarea
          rows={4}
          placeholder={
            form.systemPromptMode === 'replace'
              ? 'Substitui totalmente o prompt (padrão + customizado global) já resolvido para esta capacidade…'
              : 'Acrescentado depois do prompt já resolvido para cada capacidade (geração de questões, resposta, melhoria de mensagem)…'
          }
          value={form.systemPrompt}
          onChange={(e) => set('systemPrompt', e.target.value)}
        />
      </div>

      <div className="integration-form-row range-field">
        <label htmlFor="integration-temperature">
          Temperatura <output>{Number(form.temperature).toFixed(2)}</output>
        </label>
        <input
          id="integration-temperature"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={form.temperature}
          onChange={(e) => set('temperature', e.target.value)}
        />
      </div>

      <div className="integration-form-row">
        <label htmlFor="integration-max-tokens">Limite de tokens por interação (opcional)</label>
        <input
          id="integration-max-tokens"
          type="number"
          min={1}
          placeholder="Padrão do modelo"
          value={form.maxTokens}
          onChange={(e) => set('maxTokens', e.target.value)}
        />
      </div>

      <div className="integration-form-row range-field">
        <label htmlFor="integration-presence-penalty">
          Penalidade de presença <output>{form.presencePenalty === '' ? '—' : Number(form.presencePenalty).toFixed(1)}</output>
        </label>
        <input
          id="integration-presence-penalty"
          type="range"
          min={-2}
          max={2}
          step={0.1}
          disabled={!penaltiesSupported}
          value={form.presencePenalty === '' ? 0 : form.presencePenalty}
          onChange={(e) => set('presencePenalty', e.target.value)}
        />
        {!penaltiesSupported && (
          <p className="field-hint">{driver?.label} não suporta esse parâmetro — ignorado por este provedor.</p>
        )}
      </div>

      <div className="integration-form-row range-field">
        <label htmlFor="integration-frequency-penalty">
          Penalidade de frequência{' '}
          <output>{form.frequencyPenalty === '' ? '—' : Number(form.frequencyPenalty).toFixed(1)}</output>
        </label>
        <input
          id="integration-frequency-penalty"
          type="range"
          min={-2}
          max={2}
          step={0.1}
          disabled={!penaltiesSupported}
          value={form.frequencyPenalty === '' ? 0 : form.frequencyPenalty}
          onChange={(e) => set('frequencyPenalty', e.target.value)}
        />
        {!penaltiesSupported && (
          <p className="field-hint">{driver?.label} não suporta esse parâmetro — ignorado por este provedor.</p>
        )}
      </div>

      <div className="integration-form-row integration-form-checks">
        <label className="checkbox-field">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
          Usar como integração padrão
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          Ativa
        </label>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="integration-form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : submitLabel}
        </button>
        <button type="button" className="btn btn-ghost" disabled={saving} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function IntegrationCard({ integration, driverProviders, onChanged, onDirtyChange }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [selectedModel, setSelectedModel] = useState(integration.model || '');
  const [savingModel, setSavingModel] = useState(false);

  useEffect(() => {
    onDirtyChange?.(editing);
    return () => onDirtyChange?.(false);
  }, [editing]);

  const driver = driverProviders.find((p) => p.id === integration.provider);

  async function patch(body) {
    const response = await fetch(`/api/ai/integrations/${integration.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Falha ao salvar a integração.');
    return data;
  }

  async function handleUpdate(data) {
    await patch(data);
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    if (!window.confirm(`Remover a integração "${integration.name}"? Essa ação não pode ser desfeita.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai/integrations/${integration.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao remover a integração.');
      }
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSetDefault() {
    setBusy(true);
    setError(null);
    try {
      await patch({ isDefault: true });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive() {
    setBusy(true);
    setError(null);
    try {
      await patch({ isActive: !integration.isActive });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePicker() {
    const opening = !pickerOpen;
    setPickerOpen(opening);
    if (opening && !availableModels && !modelsLoading) {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const response = await fetch(`/api/ai/integrations/${integration.id}/models`);
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
      await patch({ model: selectedModel || null });
      setPickerOpen(false);
      onChanged();
    } catch (err) {
      setModelsError(err.message);
    } finally {
      setSavingModel(false);
    }
  }

  if (editing) {
    return (
      <div className="integration-card">
        <IntegrationForm
          driverProviders={driverProviders}
          initial={formFromIntegration(integration)}
          hasApiKey={integration.hasApiKey}
          onCancel={() => setEditing(false)}
          onSubmit={handleUpdate}
          submitLabel="Salvar alterações"
        />
      </div>
    );
  }

  return (
    <div className={`integration-card${integration.isActive ? '' : ' integration-card-inactive'}`}>
      <div className="integration-card-header">
        <h3>{integration.name}</h3>
        <div className="integration-card-badges">
          {integration.isDefault && <span className="badge">Padrão</span>}
          {!integration.isActive && <span className="badge badge-muted">Inativa</span>}
        </div>
      </div>

      <p className="card-meta">
        {driver?.label || integration.provider} · Modelo: <strong>{integration.model || driver?.defaultModel}</strong>
      </p>
      {integration.baseUrl && <p className="card-meta">URL Base: {integration.baseUrl}</p>}
      <p className="card-meta">
        Chave de API <CircleCheck size={14} strokeWidth={2} className="inline-icon" />
      </p>

      <div className="integration-card-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
          <Pencil size={14} strokeWidth={1.8} /> Editar
        </button>
        {!integration.isDefault && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={handleSetDefault}>
            <Star size={14} strokeWidth={1.8} /> Tornar padrão
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={handleToggleActive}>
          {integration.isActive ? 'Desativar' : 'Ativar'}
        </button>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={busy} onClick={handleDelete}>
          <Trash2 size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="ai-model-picker">
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
                  <option value="">Usar modelo padrão ({driver?.defaultModel})</option>
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-primary btn-sm" disabled={savingModel} onClick={handleSaveModel}>
                  {savingModel ? 'Salvando…' : 'Salvar modelo'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}

// Substitui o antigo ApiKeyManager.jsx (um componente por provider fixo) —
// agora um único componente lista e gerencia uma quantidade arbitrária de
// integrações, inclusive várias do mesmo provedor-base. `driverProviders` é
// listAiIntegrations()'s companion — os 4 drivers disponíveis
// (src/lib/aiProviders), só usados pra popular o <select> de "Provedor" no
// formulário. `onDirtyChange` agrega o estado de qualquer form aberto
// (novo ou edição), pro guard de "alterações não salvas" em ProfileTabs.
export default function IntegrationManager({ integrations: initialIntegrations, driverProviders, onDirtyChange }) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [creating, setCreating] = useState(false);
  const [cardDirty, setCardDirty] = useState(false);

  useEffect(() => {
    onDirtyChange?.(creating || cardDirty);
    return () => onDirtyChange?.(false);
  }, [creating, cardDirty]);

  async function refresh() {
    const response = await fetch('/api/ai/integrations');
    const data = await response.json().catch(() => ({}));
    if (response.ok) setIntegrations(data.integrations || []);
  }

  async function handleCreate(data) {
    const response = await fetch('/api/ai/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Falha ao criar a integração.');
    setCreating(false);
    await refresh();
  }

  return (
    <div className="integration-manager">
      {integrations.length === 0 && !creating && (
        <p className="lede">Nenhuma integração cadastrada ainda.</p>
      )}

      <div className="ai-providers-list">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            driverProviders={driverProviders}
            onChanged={refresh}
            onDirtyChange={setCardDirty}
          />
        ))}
      </div>

      {creating ? (
        <div className="integration-card">
          <IntegrationForm
            driverProviders={driverProviders}
            initial={emptyForm(driverProviders[0]?.id)}
            hasApiKey={false}
            onCancel={() => setCreating(false)}
            onSubmit={handleCreate}
            submitLabel="Criar integração"
          />
        </div>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={() => setCreating(true)}>
          <Plus size={16} strokeWidth={1.8} /> Nova integração
        </button>
      )}
    </div>
  );
}
