import axios from 'axios';
import { SYSTEM_PROMPT, buildUserMessage, buildQuizOutputSchema } from './shared';
import { REPLY_SYSTEM_PROMPT, buildReplyUserMessage } from './replyPrompt';
import { IMPROVE_SYSTEM_PROMPT, buildImproveUserMessage } from './improvePrompt';
import { STUDENT_ANALYSIS_SYSTEM_PROMPT } from './studentAnalysisPrompt';
import { logAiRequest } from './debugLog';

// Sem timeout de framework aqui (isso não roda em serverless) — sem um
// limite próprio, uma chamada anormalmente lenta fica pendurada
// indefinidamente em vez de falhar com um erro claro pro professor. Mesma
// margem que openai.js/zai.js usam.
const REQUEST_TIMEOUT_MS = 120_000;

export const id = 'deepseek';
export const label = 'DeepSeek';
export const defaultModel = 'deepseek-chat';
export const supportsTemperature = true;
export const supportsPenalties = true;

const DEFAULT_BASE_URL = 'https://api.deepseek.com';

// DeepSeek's Chat Completions API (api-docs.deepseek.com) is deliberately
// OpenAI-compatible — same request/response shape, same auth header, same
// /models discovery endpoint — but response_format only documents
// 'text' | 'json_object', no 'json_schema'/strict mode like OpenAI's. So,
// same reasoning as zai.js: the exact shape is described as text inside the
// prompt instead of a native schema field, and validateStructural()
// downstream (src/app/api/ai/integrations/[id]/generate-questions/route.js)
// is the real safety net. DeepSeek's own docs note json_object mode requires
// the word "json" to appear somewhere in the messages — already true here,
// the appended instruction below says "objeto JSON"/"JSON Schema".
const QUIZ_SCHEMA_TEXT = JSON.stringify(buildQuizOutputSchema());

function resolveBaseUrl(baseUrl) {
  return (baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

// GET /models is documented specifically as the way to verify an API key is
// valid (api-docs.deepseek.com/api/list-models) — cheap, no tokens spent,
// same approach openai.js uses.
export async function validateApiKey(apiKey, baseUrl) {
  try {
    await axios.get(`${resolveBaseUrl(baseUrl)}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: REQUEST_TIMEOUT_MS,
    });
    return { valid: true };
  } catch (error) {
    if (error.response?.status === 401) {
      return { valid: false, error: 'Chave de API inválida ou sem permissão.' };
    }
    return { valid: false, error: 'Não foi possível validar a chave junto à DeepSeek. Tente novamente.' };
  }
}

// Unlike OpenAI's /models (which mixes in embeddings/whisper/etc.), DeepSeek
// only ever lists its own chat models here — no filtering needed, same as
// claude.js's approach.
export async function listModels(apiKey, baseUrl) {
  const response = await axios.get(`${resolveBaseUrl(baseUrl)}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: REQUEST_TIMEOUT_MS,
  });
  return (response.data?.data || []).map((m) => ({ id: m.id, label: m.id }));
}

function samplingParams({ temperature, maxTokens, presencePenalty, frequencyPenalty }) {
  const params = {};
  if (temperature != null) params.temperature = temperature;
  if (maxTokens != null) params.max_tokens = maxTokens;
  if (presencePenalty != null) params.presence_penalty = presencePenalty;
  if (frequencyPenalty != null) params.frequency_penalty = frequencyPenalty;
  return params;
}

function extractMessageText(response) {
  const message = response.data?.choices?.[0]?.message;
  if (!message?.content) {
    throw new Error('A resposta da DeepSeek não contém conteúdo utilizável.');
  }
  return message.content;
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
  const userMessage = `${buildUserMessage(specs)}\n\nResponda apenas com um único objeto JSON que siga rigorosamente este JSON Schema, sem markdown e sem texto fora do JSON:\n${QUIZ_SCHEMA_TEXT}`;

  const url = `${resolveBaseUrl(baseUrl)}/chat/completions`;
  const payload = {
    model: model || defaultModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    ...samplingParams({ temperature, maxTokens, presencePenalty, frequencyPenalty }),
  };
  logAiRequest('deepseek', url, payload);

  const response = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: REQUEST_TIMEOUT_MS,
  });

  return JSON.parse(extractMessageText(response));
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
  const url = `${resolveBaseUrl(baseUrl)}/chat/completions`;
  const payload = {
    model: model || defaultModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildReplyUserMessage(context) },
    ],
    ...samplingParams({ temperature, maxTokens, presencePenalty, frequencyPenalty }),
  };
  logAiRequest('deepseek', url, payload);

  const response = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: REQUEST_TIMEOUT_MS,
  });

  return extractMessageText(response);
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
  const url = `${resolveBaseUrl(baseUrl)}/chat/completions`;
  const payload = {
    model: model || defaultModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildImproveUserMessage(text) },
    ],
    ...samplingParams({ temperature, maxTokens, presencePenalty, frequencyPenalty }),
  };
  logAiRequest('deepseek', url, payload);

  const response = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: REQUEST_TIMEOUT_MS,
  });

  return extractMessageText(response);
}

export async function analyzeStudent({
  apiKey,
  baseUrl,
  model,
  temperature,
  maxTokens,
  presencePenalty,
  frequencyPenalty,
  text,
  systemPrompt = STUDENT_ANALYSIS_SYSTEM_PROMPT,
}) {
  const url = `${resolveBaseUrl(baseUrl)}/chat/completions`;
  const payload = {
    model: model || defaultModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    ...samplingParams({ temperature, maxTokens, presencePenalty, frequencyPenalty }),
  };
  logAiRequest('deepseek', url, payload);

  const response = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: REQUEST_TIMEOUT_MS,
  });

  return extractMessageText(response);
}
