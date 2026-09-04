import axios from 'axios';
import { SYSTEM_PROMPT, buildUserMessage, buildQuizOutputSchema } from './shared';
import { REPLY_SYSTEM_PROMPT, buildReplyUserMessage } from './replyPrompt';
import { IMPROVE_SYSTEM_PROMPT, buildImproveUserMessage } from './improvePrompt';
import { logAiRequest } from './debugLog';

// Requisições ao Z.ai não têm um timeout de framework como o Vercel tem por
// padrão — sem isso, uma chamada anormalmente lenta (ver comentário do
// `thinking` abaixo) fica pendurada indefinidamente em vez de falhar com um
// erro claro.
const REQUEST_TIMEOUT_MS = 120_000;

export const id = 'zai';
export const label = 'Z.ai (GLM)';
export const defaultModel = 'glm-4.6';

const DEFAULT_BASE_URL = 'https://api.z.ai/api/paas/v4';

// Z.ai's own API doc (docs.z.ai/api-reference/llm/chat-completion) only
// documents response_format: 'text' | 'json_object' — no 'json_schema'/
// strict mode like OpenAI's. So instead of a native schema field, the
// exact shape is described as text inside the prompt (same technique
// gemini.js uses), and json_object mode just guarantees "some JSON object"
// comes back. validateStructural() downstream is the real safety net.
const QUIZ_SCHEMA_TEXT = JSON.stringify(buildQuizOutputSchema());

function resolveBaseUrl(baseUrl) {
  return (baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

// docs.z.ai has no dedicated "list models"/"validate key" endpoint, so
// validation is a minimal real chat completion call (1 output token) —
// cheap, and 401/403 tells us the key is bad the same way it would for a
// real generation call.
export async function validateApiKey(apiKey, baseUrl) {
  try {
    await axios.post(
      `${resolveBaseUrl(baseUrl)}/chat/completions`,
      { model: defaultModel, messages: [{ role: 'user', content: 'oi' }], max_tokens: 1, thinking: { type: 'disabled' } },
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: REQUEST_TIMEOUT_MS },
    );
    return { valid: true };
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      return { valid: false, error: 'Chave de API inválida ou sem permissão.' };
    }
    return { valid: false, error: 'Não foi possível validar a chave junto à Z.ai. Tente novamente.' };
  }
}

// No discovery endpoint documented for this API — list curated by hand.
// Conferir docs.z.ai/guides/overview/pricing ao atualizar.
const KNOWN_MODELS = [
  { id: 'glm-4.6', label: 'GLM-4.6' },
  { id: 'glm-4.5', label: 'GLM-4.5' },
  { id: 'glm-4.5-air', label: 'GLM-4.5-Air' },
  { id: 'glm-4.5-flash', label: 'GLM-4.5-Flash' },
];

export async function listModels() {
  return KNOWN_MODELS;
}

function samplingParams({ temperature, maxTokens }) {
  // Sem presence_penalty/frequency_penalty — não documentados nesta API.
  // `thinking: { type: 'disabled' }` é explícito e sempre enviado — a API
  // da Z.ai vem com "enabled" como padrão quando o campo é omitido
  // (docs.z.ai/api-reference/llm/chat-completion), o que liga "raciocínio
  // estendido" (tokens de reasoning ocultos, cobrados e lentos) mesmo pra
  // perguntas triviais. Sem um controle de nível de raciocínio exposto na
  // integração ainda, o padrão seguro é sempre desligado.
  const params = { thinking: { type: 'disabled' } };
  if (temperature != null) params.temperature = temperature;
  if (maxTokens != null) params.max_tokens = maxTokens;
  return params;
}

function extractMessageText(response) {
  const choice = response.data?.choices?.[0];
  const message = choice?.message;
  if (!message?.content) {
    throw new Error('A resposta da Z.ai não contém conteúdo utilizável.');
  }
  return message.content;
}

export async function generateQuestions({
  apiKey,
  baseUrl,
  model,
  temperature,
  maxTokens,
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
    ...samplingParams({ temperature, maxTokens }),
  };
  logAiRequest('zai', url, payload);

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
    ...samplingParams({ temperature, maxTokens }),
  };
  logAiRequest('zai', url, payload);

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
    ...samplingParams({ temperature, maxTokens }),
  };
  logAiRequest('zai', url, payload);

  const response = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: REQUEST_TIMEOUT_MS,
  });

  return extractMessageText(response);
}
