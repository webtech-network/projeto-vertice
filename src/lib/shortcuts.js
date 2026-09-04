import { useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';
import { useRealtimeTable } from '@/lib/realtime/useRealtimeTable';
import { DEFAULT_SHORTCUT_ICON_ID } from './shortcutIcons';

function toApp(row) {
  return {
    id: row.id,
    label: row.label,
    url: row.url,
    icon: row.icon,
    order: row.sort_order,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function listShortcuts() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from('shortcuts').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return data.map(toApp);
}

export async function saveShortcut({ id, label, url, icon }) {
  const supabase = createSupabaseBrowserClient();

  if (id) {
    const { data, error } = await supabase
      .from('shortcuts')
      .update({ label, url, ...(icon ? { icon } : {}) })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return toApp(data);
  }

  const shortcuts = await listShortcuts();
  const { data, error } = await supabase
    .from('shortcuts')
    .insert({ label, url, icon: icon || DEFAULT_SHORTCUT_ICON_ID, sort_order: shortcuts.length })
    .select()
    .single();
  if (error) throw error;
  return toApp(data);
}

export async function deleteShortcut(id) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from('shortcuts').delete().eq('id', id);
  if (error) throw error;
}

// Rewrites the `sort_order` field for every shortcut to match `orderedIds`'
// index — no drag library, just up/down buttons in ShortcutsManager
// reordering an array and calling this.
export async function reorderShortcuts(orderedIds) {
  const supabase = createSupabaseBrowserClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from('shortcuts').update({ sort_order: index }).eq('id', id)),
  );
}

// Client-component hook: local state mirroring the shortcuts table, with a
// refresh() callers invoke after any mutation (save/delete/reorder).
export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setShortcuts(await listShortcuts());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime — sincronização multi-dispositivo ao vivo (Fase 2). Lista
  // simples sem campo de texto livre em edição prolongada, então um evento
  // remoto só dispara um refresh completo (sem risco de sobrescrever um
  // rascunho, ao contrário de PromptCustomizer.jsx/CourseNoteEditor.jsx).
  // DELETE físico existe aqui (deleteShortcut), ao contrário das tabelas com
  // tombstone — por isso onDelete também refaz o refresh.
  useRealtimeTable('shortcuts', { onInsert: refresh, onUpdate: refresh, onDelete: refresh });

  return { shortcuts, loading, refresh };
}
