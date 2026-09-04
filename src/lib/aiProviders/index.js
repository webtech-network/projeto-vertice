import * as openai from './openai';
import * as gemini from './gemini';
import * as claude from './claude';
import * as zai from './zai';

/**
 * Adapter contract every provider (driver) module implements:
 *   id: string                 — stable key, used in public.ai_integrations.provider and route URLs
 *   label: string              — display name
 *   defaultModel: string       — used when an integration doesn't set its own `model`
 *   supportsTemperature: boolean — whether this driver's API accepts `temperature` at all (see claude.js)
 *   supportsPenalties: boolean   — whether this driver's API accepts presence_penalty/frequency_penalty
 *   validateApiKey(apiKey, baseUrl?): Promise<{ valid: boolean, error?: string }>
 *   listModels(apiKey, baseUrl?): Promise<Array<{ id: string, label: string }>>  — models the user can pick from in /perfil
 *   generateQuestions({ apiKey, baseUrl?, model, temperature?, maxTokens?, presencePenalty?, frequencyPenalty?, specs, systemPrompt? }): Promise<quiz>  — quiz.schema.json shape
 *   suggestReply({ apiKey, baseUrl?, model, temperature?, maxTokens?, presencePenalty?, frequencyPenalty?, context, systemPrompt? }): Promise<string>  — plain-text reply suggestion
 *   improveMessage({ apiKey, baseUrl?, model, temperature?, maxTokens?, presencePenalty?, frequencyPenalty?, text, systemPrompt? }): Promise<string>   — plain-text revised draft
 *
 * `baseUrl` lets one integration point its driver at any API-compatible
 * endpoint (e.g. an 'openai' integration pointed at an OpenAI-compatible
 * third-party host) — omitted/null means the driver's own hardcoded
 * default host. `temperature`/`maxTokens`/`presencePenalty`/`frequencyPenalty`
 * come from the integration's own saved config (public.ai_integrations);
 * a driver whose API doesn't support a given knob (`supportsTemperature`/
 * `supportsPenalties` above — e.g. no penalties on Claude/Z.ai, and, as of
 * the current model generation, no temperature on Claude either) just drops
 * it silently, never throws for an unsupported param. `listProviders()`
 * exposes those two flags so the "Nova integração" form (IntegrationManager.jsx)
 * can grey out controls that wouldn't do anything for the chosen driver.
 *
 * `systemPrompt` on all three defaults to that capability's own constant
 * (SYSTEM_PROMPT / REPLY_SYSTEM_PROMPT / IMPROVE_SYSTEM_PROMPT) when omitted
 * — routes pass a resolved override here, layering the capability's default
 * + the user's global custom prompt + the integration's own system prompt
 * (see src/lib/promptResolution.js + src/lib/customPrompts.js).
 *
 * To add a new driver (a genuinely new API protocol): write a module
 * implementing this contract (see zai.js for the simplest OpenAI-compatible
 * reference) and add it to PROVIDERS below — nothing else in the app needs
 * to change. Adding another *platform* that already speaks one of these
 * protocols (e.g. another OpenAI-compatible host) needs no code at all —
 * just a new integration with its own `base_url`.
 */
export const PROVIDERS = [openai, gemini, claude, zai];

export function getProvider(providerId) {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) {
    throw new Error(`Provedor de IA desconhecido: ${providerId}`);
  }
  return provider;
}

export function listProviders() {
  return PROVIDERS.map(({ id, label, defaultModel, supportsTemperature, supportsPenalties }) => ({
    id,
    label,
    defaultModel,
    supportsTemperature,
    supportsPenalties,
  }));
}
