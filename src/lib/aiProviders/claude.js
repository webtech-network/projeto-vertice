import axios from 'axios';
import { SYSTEM_PROMPT, buildUserMessage, buildQuizOutputSchema } from './shared';
import { REPLY_SYSTEM_PROMPT, buildReplyUserMessage } from './replyPrompt';
import { IMPROVE_SYSTEM_PROMPT, buildImproveUserMessage } from './improvePrompt';
import { logAiRequest } from './debugLog';

export const id = 'claude';
export const label = 'Anthropic Claude';
export const defaultModel = 'claude-sonnet-5';
// Ver o comentário grande acima de generateQuestions: a Anthropic
// descontinuou temperature/top_p/top_k nos modelos atuais.
export const supportsTemperature = false;
export const supportsPenalties = false;

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

// Sem timeout de framework aqui (isso não roda em serverless) — sem um
// limite próprio, uma chamada anormalmente lenta fica pendurada
// indefinidamente em vez de falhar com um erro claro pro professor.
const REQUEST_TIMEOUT_MS = 120_000;

const QUIZ_SCHEMA = buildQuizOutputSchema();

function resolveBaseUrl(baseUrl) {
  return (baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function authHeaders(apiKey) {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
  };
}

export async function validateApiKey(apiKey, baseUrl) {
  try {
    await axios.get(`${resolveBaseUrl(baseUrl)}/models`, { headers: authHeaders(apiKey) });
    return { valid: true };
  } catch (error) {
    if (error.response?.status === 401) {
      return { valid: false, error: 'Chave de API inválida ou sem permissão.' };
    }
    return { valid: false, error: 'Não foi possível validar a chave junto à Anthropic. Tente novamente.' };
  }
}

// Unlike OpenAI's /v1/models, this endpoint only ever lists Claude chat
// models (no embeddings/whisper/etc. mixed in) — no filtering needed.
// "More recently released models are listed first" per Anthropic's own docs.
export async function listModels(apiKey, baseUrl) {
  const response = await axios.get(`${resolveBaseUrl(baseUrl)}/models`, {
    headers: authHeaders(apiKey),
    params: { limit: 100 },
  });
  return (response.data?.data || []).map((m) => ({ id: m.id, label: m.display_name || m.id }));
}

// Anthropic's Messages API has no presence_penalty/frequency_penalty
// concept at all, and — as of the current model generation (including
// claude-sonnet-5, this driver's own default) — no longer accepts
// `temperature`/`top_p`/`top_k` either: Anthropic deprecated those sampling
// params on newer models and the API now rejects the *whole* request with a
// 400 ("temperature is deprecated for this model") if the field is present
// at all, even set to 1. Unlike the penalties (accepted-but-dropped for
// contract consistency, see index.js), `temperature` isn't even read out of
// the destructured params below — it must never reach the request body.
export async function generateQuestions({
  apiKey,
  baseUrl,
  model,
  maxTokens,
  specs,
  systemPrompt = SYSTEM_PROMPT,
}) {
  // Structured output via forced tool use: Claude must call `emit_quiz`, and
  // Anthropic parses its input against input_schema for us — no JSON.parse
  // of free text needed, unlike the OpenAI/Gemini/Z.ai adapters.
  const url = `${resolveBaseUrl(baseUrl)}/messages`;
  const payload = {
    model: model || defaultModel,
    max_tokens: maxTokens || 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: buildUserMessage(specs) }],
    tools: [
      {
        name: 'emit_quiz',
        description: 'Emite o quiz gerado, no formato solicitado.',
        input_schema: QUIZ_SCHEMA,
      },
    ],
    tool_choice: { type: 'tool', name: 'emit_quiz' },
  };
  logAiRequest('claude', url, payload);

  const response = await axios.post(url, payload, { headers: authHeaders(apiKey), timeout: REQUEST_TIMEOUT_MS });

  const toolUse = (response.data?.content || []).find((block) => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('A resposta da Anthropic não contém conteúdo utilizável.');
  }

  return toolUse.input;
}

export async function suggestReply({
  apiKey,
  baseUrl,
  model,
  maxTokens,
  context,
  systemPrompt = REPLY_SYSTEM_PROMPT,
}) {
  const url = `${resolveBaseUrl(baseUrl)}/messages`;
  const payload = {
    model: model || defaultModel,
    max_tokens: maxTokens || 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: buildReplyUserMessage(context) }],
  };
  logAiRequest('claude', url, payload);

  const response = await axios.post(url, payload, { headers: authHeaders(apiKey), timeout: REQUEST_TIMEOUT_MS });

  const textBlock = (response.data?.content || []).find((block) => block.type === 'text');
  if (!textBlock) {
    throw new Error('A resposta da Anthropic não contém conteúdo utilizável.');
  }

  return textBlock.text;
}

export async function improveMessage({
  apiKey,
  baseUrl,
  model,
  maxTokens,
  text,
  systemPrompt = IMPROVE_SYSTEM_PROMPT,
}) {
  const url = `${resolveBaseUrl(baseUrl)}/messages`;
  const payload = {
    model: model || defaultModel,
    max_tokens: maxTokens || 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: buildImproveUserMessage(text) }],
  };
  logAiRequest('claude', url, payload);

  const response = await axios.post(url, payload, { headers: authHeaders(apiKey), timeout: REQUEST_TIMEOUT_MS });

  const textBlock = (response.data?.content || []).find((block) => block.type === 'text');
  if (!textBlock) {
    throw new Error('A resposta da Anthropic não contém conteúdo utilizável.');
  }

  return textBlock.text;
}
