import axios from 'axios';
import { SYSTEM_PROMPT, buildUserMessage, buildQuizOutputSchema } from './shared';
import { REPLY_SYSTEM_PROMPT, buildReplyUserMessage } from './replyPrompt';
import { IMPROVE_SYSTEM_PROMPT, buildImproveUserMessage } from './improvePrompt';
import { logAiRequest } from './debugLog';

export const id = 'gemini';
export const label = 'Google Gemini';
export const defaultModel = 'gemini-2.0-flash';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Sem timeout de framework aqui (isso não roda em serverless) — sem um
// limite próprio, uma chamada anormalmente lenta fica pendurada
// indefinidamente em vez de falhar com um erro claro pro professor.
const REQUEST_TIMEOUT_MS = 120_000;

function resolveBaseUrl(baseUrl) {
  return (baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

// Gemini's native `responseSchema` field uses a proto-derived schema dialect
// (type names, nesting support) that's easy to get subtly wrong from outside
// the SDK. Instead of wiring the schema into that field, we only ask for
// `responseMimeType: 'application/json'` (plain JSON mode) and describe the
// exact shape in the prompt as standard JSON Schema text — same schema
// every other adapter uses, just conveyed differently. Output is still
// re-validated after the fact via validateStructural(), same as the others.
const QUIZ_SCHEMA_TEXT = JSON.stringify(buildQuizOutputSchema());

export async function validateApiKey(apiKey, baseUrl) {
  try {
    await axios.get(`${resolveBaseUrl(baseUrl)}/models`, { params: { key: apiKey } });
    return { valid: true };
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 403) {
      return { valid: false, error: 'Chave de API inválida ou sem permissão.' };
    }
    return { valid: false, error: 'Não foi possível validar a chave junto ao Gemini. Tente novamente.' };
  }
}

// `name` comes back as "models/gemini-2.0-flash" — stripped to the bare id
// this app's own generateContent URLs already expect elsewhere (see
// defaultModel above). Filtered to models that actually support
// generateContent (the API this app calls) — the list also includes
// embedding-only and other non-chat models with no such support.
export async function listModels(apiKey, baseUrl) {
  const response = await axios.get(`${resolveBaseUrl(baseUrl)}/models`, { params: { key: apiKey, pageSize: 100 } });
  return (response.data?.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }));
}

// generationConfig knobs shared by the 3 generation calls below — omitted
// when undefined/null so the API falls back to its own default.
function generationConfig({ temperature, maxTokens, presencePenalty, frequencyPenalty }) {
  const config = {};
  if (temperature != null) config.temperature = temperature;
  if (maxTokens != null) config.maxOutputTokens = maxTokens;
  if (presencePenalty != null) config.presencePenalty = presencePenalty;
  if (frequencyPenalty != null) config.frequencyPenalty = frequencyPenalty;
  return config;
}

export async function generateQuestions({
  apiKey,
  baseUrl,
  model,
  temperature,
  maxTokens,
  presencePenalty,
  frequencyPenalty,
  specs,
  systemPrompt = SYSTEM_PROMPT,
}) {
  const prompt = `${buildUserMessage(specs)}\n\nResponda apenas com um único objeto JSON que siga rigorosamente este JSON Schema, sem markdown e sem texto fora do JSON:\n${QUIZ_SCHEMA_TEXT}`;

  const url = `${resolveBaseUrl(baseUrl)}/models/${model || defaultModel}:generateContent`;
  const payload = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      ...generationConfig({ temperature, maxTokens, presencePenalty, frequencyPenalty }),
    },
  };
  logAiRequest('gemini', url, payload);

  const response = await axios.post(url, payload, { params: { key: apiKey }, timeout: REQUEST_TIMEOUT_MS });

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('A resposta do Gemini não contém conteúdo utilizável.');
  }

  return JSON.parse(text);
}

export async function suggestReply({
  apiKey,
  baseUrl,
  model,
  temperature,
  maxTokens,
  presencePenalty,
  frequencyPenalty,
  context,
  systemPrompt = REPLY_SYSTEM_PROMPT,
}) {
  const url = `${resolveBaseUrl(baseUrl)}/models/${model || defaultModel}:generateContent`;
  const payload = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: buildReplyUserMessage(context) }] }],
    generationConfig: generationConfig({ temperature, maxTokens, presencePenalty, frequencyPenalty }),
  };
  logAiRequest('gemini', url, payload);

  const response = await axios.post(url, payload, { params: { key: apiKey }, timeout: REQUEST_TIMEOUT_MS });

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('A resposta do Gemini não contém conteúdo utilizável.');
  }

  return text;
}

export async function improveMessage({
  apiKey,
  baseUrl,
  model,
  temperature,
  maxTokens,
  presencePenalty,
  frequencyPenalty,
  text,
  systemPrompt = IMPROVE_SYSTEM_PROMPT,
}) {
  const url = `${resolveBaseUrl(baseUrl)}/models/${model || defaultModel}:generateContent`;
  const payload = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: buildImproveUserMessage(text) }] }],
    generationConfig: generationConfig({ temperature, maxTokens, presencePenalty, frequencyPenalty }),
  };
  logAiRequest('gemini', url, payload);

  const response = await axios.post(url, payload, { params: { key: apiKey }, timeout: REQUEST_TIMEOUT_MS });

  const improved = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!improved) {
    throw new Error('A resposta do Gemini não contém conteúdo utilizável.');
  }

  return improved;
}
