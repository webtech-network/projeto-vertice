'use client';

import { useEffect, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

/**
 * Assina mudanças em `table` via Supabase Realtime (postgres_changes). RLS
 * já escopa cada assinante às próprias linhas (auth.uid() = user_id em
 * todas as tabelas publicadas — ver supabase/volumes/db/init/05_rls.sql),
 * então nenhum filtro de user_id precisa ser passado aqui. `filter`
 * (opcional, sintaxe "coluna=eq.valor" do Realtime) restringe a uma
 * linha/subconjunto quando o assinante não se importa com a tabela inteira
 * (ver PromptCustomizer.jsx/CourseNoteEditor.jsx).
 *
 * `onInsert`/`onUpdate`/`onDelete` passam por uma ref interna — podem ser
 * recriados a cada render (fechando sobre dispatch/estado local mais
 * recente) sem reabrir o canal a cada render. O canal só é recriado se
 * `table`/`filter` mudarem.
 */
export function useRealtimeTable(table, { filter, onInsert, onUpdate, onDelete } = {}) {
  const handlersRef = useRef({});
  handlersRef.current = { onInsert, onUpdate, onDelete };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channelName = `realtime:${table}:${filter || 'all'}:${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload) => {
          const { current } = handlersRef;
          if (payload.eventType === 'INSERT') current.onInsert?.(payload.new);
          else if (payload.eventType === 'UPDATE') current.onUpdate?.(payload.new, payload.old);
          else if (payload.eventType === 'DELETE') current.onDelete?.(payload.old);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]);
}
