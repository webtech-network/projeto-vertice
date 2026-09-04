'use client';

import { useEffect, useRef, useState } from 'react';
import { Save, Pencil, X } from 'lucide-react';
import MarkdownEditor from './MarkdownEditor';
import { markdownToHtml } from '@/lib/markdown';
import { getCourseNote, saveCourseNoteLocal, toApp as noteToApp } from '@/lib/courseNotes/courseNotesRepo';
import { useRealtimeTable } from '@/lib/realtime/useRealtimeTable';

function formatDateTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// Read-only rendering surface for "view" mode: unlike MarkdownEditor's rich
// mode, this div is never contentEditable, so links render as normal
// clickable anchors (a contentEditable anchor swallows a plain click to
// place the caret instead of navigating). Uses the same ref+innerHTML
// pattern as MarkdownEditor.jsx's rich mode rather than
// dangerouslySetInnerHTML, for consistency with that existing surface —
// markdownToHtml escapes source text before building any tag, so this is
// never a raw-HTML pass-through.
function CourseNoteView({ text }) {
  const viewRef = useRef(null);

  useEffect(() => {
    if (viewRef.current) viewRef.current.innerHTML = markdownToHtml(text) || '';
  }, [text]);

  if (!text?.trim()) {
    return <p className="lede">Nenhuma anotação registrada ainda. Clique em "Editar" para começar.</p>;
  }

  return <div ref={viewRef} className="course-note-view" />;
}

// Rendered inline, directly below a course's row in CourseBrowser.jsx's
// table, when that course's name is clicked. Lê/escreve direto no Postgres
// (RLS-scoped) — sem sync via Drive, o Postgres já é multi-dispositivo por
// si só.
export default function CourseNoteEditor({ courseId, courseCode }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('view'); // view | edit
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Last text known to be persisted — "Cancelar" reverts to this instead of
  // whatever's mid-edit.
  const savedTextRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    getCourseNote(courseCode).then((note) => {
      if (cancelled) return;
      setText(note?.text || '');
      savedTextRef.current = note?.text || '';
      setLastSavedAt(note?.updatedAt || null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [courseCode]);

  // Realtime — sincronização multi-dispositivo ao vivo (Fase 2). Só aplica o
  // evento remoto fora do modo "edit" (sempre o valor do render mais
  // recente — useRealtimeTable resincroniza os handlers a cada render) —
  // do contrário destruiria o rascunho que o usuário está digitando. Editar
  // depois e salvar sobrescreve com o texto local (last-write-wins, mesma
  // filosofia de tasksRepo.js/recordMerge.js — sem merge de conflito).
  useRealtimeTable('course_notes', {
    filter: `course_code=eq.${courseCode}`,
    onInsert: (row) => {
      if (mode === 'edit') return;
      const note = noteToApp(row);
      setText(note.text || '');
      savedTextRef.current = note.text || '';
      setLastSavedAt(note.updatedAt || null);
    },
    onUpdate: (row) => {
      if (mode === 'edit') return;
      const note = noteToApp(row);
      setText(note.text || '');
      savedTextRef.current = note.text || '';
      setLastSavedAt(note.updatedAt || null);
    },
  });

  async function handleSave() {
    setSaving(true);
    try {
      const record = await saveCourseNoteLocal(courseCode, { courseId, text });
      savedTextRef.current = text;
      setLastSavedAt(record.updatedAt);
      setMode('view');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setText(savedTextRef.current);
    setMode('view');
  }

  return (
    <div className="course-note-editor">
      <div className="course-note-editor-topbar">
        <h3 className="course-note-editor-title">Notas do curso</h3>

        <div className="course-note-editor-topbar-right">
          {lastSavedAt && (
            <span className="course-note-editor-status">
              Salvo — {formatDateTime(new Date(lastSavedAt).toISOString())}
            </span>
          )}

          {mode === 'view' ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode('edit')} disabled={loading}>
              <Pencil size={15} strokeWidth={1.8} />
              Editar
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleCancel} disabled={saving}>
                <X size={15} strokeWidth={1.8} />
                Cancelar
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                <Save size={15} strokeWidth={1.8} />
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <p className="lede">Carregando anotações…</p>
      ) : mode === 'view' ? (
        <CourseNoteView text={text} />
      ) : (
        <MarkdownEditor value={text} onChange={setText} disabled={saving} />
      )}
    </div>
  );
}
