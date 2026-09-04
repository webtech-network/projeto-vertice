import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';
import { SYSTEM_PROMPT } from './aiProviders/shared';
import { REPLY_SYSTEM_PROMPT } from './aiProviders/replyPrompt';
import { IMPROVE_SYSTEM_PROMPT } from './aiProviders/improvePrompt';

// One entry per AI-backed capability in the app — `key` must match what the
// three trigger components (QuestionGenerator, MessageList, ComposeMessage)
// send as `customPromptText`/`customPromptMode` in their POST bodies, and
// what the three AI routes read from the request body. `defaultPrompt` is
// imported only for display/preview purposes here (PromptCustomizer shows
// it read-only) — the actual default used at generation time still lives in
// each route, resolved server-side.
export const CAPABILITIES = [
  { key: 'generateQuestions', label: 'Geração de questões', defaultPrompt: SYSTEM_PROMPT },
  { key: 'suggestReply', label: 'Sugestão de resposta', defaultPrompt: REPLY_SYSTEM_PROMPT },
  { key: 'improveMessage', label: 'Melhoria de mensagem', defaultPrompt: IMPROVE_SYSTEM_PROMPT },
];

// Exportado — reaproveitado por PromptCustomizer.jsx pra mapear linhas cruas
// que chegam via Realtime (useRealtimeTable), sem duplicar este mapeamento.
export function toApp(row) {
  if (!row) return null;
  return { capability: row.capability, text: row.text, mode: row.mode, updatedAt: new Date(row.updated_at).getTime() };
}

export async function getCustomPrompt(capability) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('custom_prompts')
    .select('*')
    .eq('capability', capability)
    .maybeSingle();
  if (error) throw error;
  return toApp(data);
}

export async function getAllCustomPrompts() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from('custom_prompts').select('*');
  if (error) throw error;
  return data.map(toApp);
}

// mode: 'append' (default — text is appended to the default prompt) or
// 'replace' (text replaces the default prompt entirely).
export async function saveCustomPrompt(capability, { text, mode }) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('custom_prompts')
    .upsert({ capability, text, mode: mode === 'replace' ? 'replace' : 'append' }, { onConflict: 'user_id,capability' })
    .select()
    .single();
  if (error) throw error;
  return toApp(data);
}

export async function clearCustomPrompt(capability) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from('custom_prompts').delete().eq('capability', capability);
  if (error) throw error;
}
