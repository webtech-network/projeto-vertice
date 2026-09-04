import axios from 'axios';
import { SYSTEM_PROMPT, buildUserMessage, buildQuizOutputSchema } from './shared';
import { REPLY_SYSTEM_PROMPT, buildReplyUserMessage } from './replyPrompt';
import { IMPROVE_SYSTEM_PROMPT, buildImproveUserMessage } from './improvePrompt';
import { logAiRequest } from './debugLog';

export const id = 'openai';
export const label = 'OpenAI (ChatGPT)';
export const defaultModel = 'gpt-4o-mini';
export const supportsTemperature = true;
export const supportsPenalties = true;

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

// Sem timeout de framework aqui (isso não roda em serverless) — sem um
// limite próprio, uma chamada anormalmente lenta fica pendurada
// indefinidamente em vez de falhar com um erro claro pro professor.
const REQUEST_TIMEOUT_MS = 120_000;

const OPENAI_SCHEMA = buildQuizOutputSchema();

function resolveBaseUrl(baseUrl) {
  return (baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export async function validateApiKey(apiKey, baseUrl) {
  try {
    await axios.get(`${resolveBaseUrl(baseUrl)}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return { valid: true };
  } catch (error) {
    if (error.response?.status === 401) {
      return { valid: false, error: 'Chave de API inválida ou sem permissão.' };
    }
    return { valid: false, error: 'Não foi possível validar a chave junto à OpenAI. Tente novamente.' };
  }
}

// GET /v1/models returns every model OpenAI has (chat, embeddings, whisper,
// tts, dall-e, moderation, ...) with no capability/type field to filter by —
// unlike Anthropic's and Gemini's equivalents. Filtering down to
// chat-capable models is therefore a heuristic on the id string, not
// something the API tells us directly.
const NON_CHAT_MODEL_PATTERN =
  /whisper|tts|dall-e|embedding|moderation|davinci|babbage|curie|(^|-)ada(-|$)|audio|realtime|transcribe|image|computer-use|search-preview/i;

export async function listModels(apiKey, baseUrl) {
  const response = await axios.get(`${resolveBaseUrl(baseUrl)}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return (response.data?.data || [])
    .filter((m) => !NON_CHAT_MODEL_PATTERN.test(m.id))
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .map((m) => ({ id: m.id, label: m.id }));
}

// Sampling knobs shared by the 3 generation calls below — omitted from the
// payload when undefined/null so the API falls back to its own default,
// rather than us second-guessing what that default is.
function samplingParams({ temperature, maxTokens, presencePenalty, frequencyPenalty }) {
  const params = {};
  if (temperature != null) params.temperature = temperature;
  if (maxTokens != null) params.max_tokens = maxTokens;
  if (presencePenalty != null) params.presence_penalty = presencePenalty;
  if (frequencyPenalty != null) params.frequency_penalty = frequencyPenalty;
  return params;
}

// Extracts the assistant's text (or throws on refusal/content-filter) from a
// Chat Completions response — shared by all 3 capabilities below.
function extractMessageText(response, providerLabel) {
  const choice = response.data?.choices?.[0];
  const message = choice?.message;
  if (!message) {
    throw new Error(`A resposta da ${providerLabel} não contém conteúdo utilizável.`);
  }
  if (message.refusal) {
    throw new Error(`A ${providerLabel} recusou a geração: ${message.refusal}`);
  }
  if (choice.finish_reason === 'content_filter') {
    throw new Error(`A ${providerLabel} recusou a geração (filtro de conteúdo).`);
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
  const url = `${resolveBaseUrl(baseUrl)}/chat/completions`;
  const payload = {
    model: model || defaultModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserMessage(specs) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'quiz', schema: OPENAI_SCHEMA, strict: true },
    },
    ...samplingParams({ temperature, maxTokens, presencePenalty, frequencyPenalty }),
  };
  logAiRequest('openai', url, payload);

  const response = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: REQUEST_TIMEOUT_MS,
  });

  const text = extractMessageText(response, 'OpenAI');
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
  const url = `${resolveBaseUrl(baseUrl)}/chat/completions`;
  const payload = {
    model: model || defaultModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildReplyUserMessage(context) },
    ],
    ...samplingParams({ temperature, maxTokens, presencePenalty, frequencyPenalty }),
  };
  logAiRequest('openai', url, payload);

  const response = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: REQUEST_TIMEOUT_MS,
  });

  return extractMessageText(response, 'OpenAI');
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
  logAiRequest('openai', url, payload);

  const response = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: REQUEST_TIMEOUT_MS,
  });

  return extractMessageText(response, 'OpenAI');
}
