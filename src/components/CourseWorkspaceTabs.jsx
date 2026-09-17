'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { NotebookText, ListChecks, Mail, Users, Maximize2 } from 'lucide-react';
import CourseNoteEditor from './CourseNoteEditor';
import AssignmentsTable from './AssignmentsTable';
import ComposeMessage from './ComposeMessage';
import MessageList from './MessageList';
import StudentReport from './StudentReport';
import { buildStudentRows } from '@/lib/studentReport';
import { listCourseAssignments, listCourseStudentsCached } from '@/lib/tasks/canvasResolution';

const TABS = [
  { key: 'notas', label: 'Anotações', Icon: NotebookText },
  { key: 'atividades', label: 'Atividades', Icon: ListChecks },
  { key: 'mensagens', label: 'Mensagens', Icon: Mail },
  { key: 'alunos', label: 'Alunos', Icon: Users },
];
const TAB_KEYS = TABS.map((t) => t.key);

// One integrated view of a course's Anotações/Atividades/Mensagens/Alunos,
// replacing what used to be CourseNoteEditor alone (inline row) plus three
// separate pages (courses/[courseId]/atividades|mensagens|alunos, now thin
// redirects here — see those files). Rendered in two places: inline, below a
// course's row in CourseBrowser.jsx (with `expandHref` pointing at the
// dedicated `/courses/[courseId]` page for a "tela cheia" version), and on
// that dedicated page itself (no `expandHref` — already full screen there).
//
// Each tab's data is fetched client-side, lazily, the first time that tab is
// opened (same "fetch on demand" pattern as IntegrationManager.jsx's model
// picker) — never all four at once, since a course row might get expanded
// just to jot down a quick note. Atividades/Alunos reuse
// canvasResolution.js's stale-while-revalidate cached fetchers (the same
// ones TaskDetailModal's course/assignment/student pickers already use), so
// switching between two courses' expanded rows doesn't re-hit Canvas if
// either was already resolved recently elsewhere in the app.
export default function CourseWorkspaceTabs({ courseId, courseCode, initialTab, expandHref }) {
  const [tab, setTab] = useState(TAB_KEYS.includes(initialTab) ? initialTab : 'notas');

  const [assignments, setAssignments] = useState({ data: [], loading: false });
  const assignmentsStarted = useRef(false);
  useEffect(() => {
    if (tab !== 'atividades' || assignmentsStarted.current) return;
    assignmentsStarted.current = true;
    setAssignments((s) => ({ ...s, loading: true }));
    listCourseAssignments(courseId).then((data) => setAssignments({ data: data || [], loading: false }));
  }, [tab, courseId]);

  const [students, setStudents] = useState({ data: [], loading: false });
  const studentsStarted = useRef(false);
  useEffect(() => {
    if (tab !== 'alunos' || studentsStarted.current) return;
    studentsStarted.current = true;
    setStudents((s) => ({ ...s, loading: true }));
    listCourseStudentsCached(courseId).then((data) => setStudents({ data: data || [], loading: false }));
  }, [tab, courseId]);
  const studentRows = useMemo(() => buildStudentRows(students.data), [students.data]);

  const [conversations, setConversations] = useState({ data: [], loading: false, error: null });
  const conversationsStarted = useRef(false);
  useEffect(() => {
    if (tab !== 'mensagens' || conversationsStarted.current) return;
    conversationsStarted.current = true;
    setConversations((s) => ({ ...s, loading: true }));
    fetch(`/api/canvas/courses/${courseId}/messages`)
      .then((r) => r.json())
      .then((data) => setConversations({ data: data.conversations || [], loading: false, error: data.loadError || null }))
      .catch(() => setConversations({ data: [], loading: false, error: 'Falha ao carregar as mensagens deste curso.' }));
  }, [tab, courseId]);

  // Mensagens and Alunos both need the professor's configured AI
  // integrations (reply/message suggestions) plus the Canvas session's
  // baseUrl/currentUserId — fetched together, once, whichever of those two
  // tabs is opened first. Failures degrade gracefully to empty defaults: the
  // AI picker just doesn't show up (same "integrations.length === 0" branch
  // ComposeMessage/MessageList/StudentReport already handle).
  const [session, setSession] = useState({ baseUrl: '', currentUserId: null, integrations: [], loading: false });
  const sessionStarted = useRef(false);
  useEffect(() => {
    if ((tab !== 'mensagens' && tab !== 'alunos') || sessionStarted.current) return;
    sessionStarted.current = true;
    setSession((s) => ({ ...s, loading: true }));
    Promise.all([
      fetch('/api/canvas/status').then((r) => r.json()),
      fetch('/api/ai/integrations/configured').then((r) => r.json()),
    ])
      .then(([status, integrationsRes]) => {
        setSession({
          baseUrl: status.baseUrl || '',
          currentUserId: status.providerUserId ? Number(status.providerUserId) : null,
          integrations: integrationsRes.integrations || [],
          loading: false,
        });
      })
      .catch(() => setSession({ baseUrl: '', currentUserId: null, integrations: [], loading: false }));
  }, [tab]);

  return (
    <div className="course-workspace-tabs">
      <div className="course-workspace-tabs-header">
        <div className="tab-folder" role="tablist" aria-label="Seções do curso">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`tab-folder-btn${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              <Icon size={16} strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </div>
        {expandHref && (
          <Link href={expandHref} className="btn btn-secondary btn-sm" title="Abrir o curso em uma página própria">
            <Maximize2 size={14} strokeWidth={2} aria-hidden="true" />
            Tela cheia
          </Link>
        )}
      </div>

      <div className="tab-folder-panel" role="tabpanel">
        {tab === 'notas' && <CourseNoteEditor courseId={courseId} courseCode={courseCode} />}

        {tab === 'atividades' &&
          (assignments.loading && assignments.data.length === 0 ? (
            <p className="lede">Carregando atividades…</p>
          ) : (
            <AssignmentsTable courseId={courseId} assignments={assignments.data} />
          ))}

        {tab === 'mensagens' && (
          <>
            <ComposeMessage courseId={courseId} integrations={session.integrations} />
            {conversations.loading && conversations.data.length === 0 ? (
              <p className="lede">Carregando mensagens…</p>
            ) : conversations.error ? (
              <p className="alert alert-error" role="alert">
                {conversations.error}
              </p>
            ) : (
              <MessageList
                conversations={conversations.data}
                currentUserId={session.currentUserId}
                baseUrl={session.baseUrl}
                integrations={session.integrations}
              />
            )}
          </>
        )}

        {tab === 'alunos' &&
          (students.loading && studentRows.length === 0 ? (
            <p className="lede">Carregando alunos…</p>
          ) : (
            <StudentReport
              rows={studentRows}
              courseId={courseId}
              baseUrl={session.baseUrl}
              integrations={session.integrations}
            />
          ))}
      </div>
    </div>
  );
}
