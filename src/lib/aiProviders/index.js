import * as openai from './openai';
import * as gemini from './gemini';
import * as claude from './claude';

/**
 * Adapter contract every provider module implements:
 *   id: string                 — stable key, used in public.ai_provider_keys.provider and route URLs
 *   label: string              — display name
 *   defaultModel: string       — used when no model override is supplied
 *   validateApiKey(apiKey): Promise<{ valid: boolean, error?: string }>
 *   listModels(apiKey): Promise<Array<{ id: string, label: string }>>  — models the user can pick from in /perfil
 *   generateQuestions({ apiKey, model, specs, systemPrompt? }): Promise<quiz>  — quiz.schema.json shape
 *   suggestReply({ apiKey, model, context, systemPrompt? }): Promise<string>  — plain-text reply suggestion
 *   improveMessage({ apiKey, model, text, systemPrompt? }): Promise<string>   — plain-text revised draft
 *
 * `systemPrompt` on all three defaults to that capability's own constant
 * (SYSTEM_PROMPT / REPLY_SYSTEM_PROMPT / IMPROVE_SYSTEM_PROMPT) when omitted
 * — routes pass a resolved override here when the user has a custom prompt
 * saved (see src/lib/promptResolution.js + src/lib/customPrompts.js).
 *
 * To add a new provider: write a module implementing this contract (see
 * openai.js for the simplest reference) and add it to PROVIDERS below —
 * nothing else in the app needs to change.
 */
export const PROVIDERS = [openai, gemini, claude];

export function getProvider(providerId) {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) {
    throw new Error(`Provedor de IA desconhecido: ${providerId}`);
  }
  return provider;
}

export function listProviders() {
  return PROVIDERS.map(({ id, label, defaultModel }) => ({ id, label, defaultModel }));
}
