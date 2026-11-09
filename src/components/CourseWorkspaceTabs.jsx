'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { NotebookText, ListChecks, Mail, Users, Maximize2 } from 'lucide-react';
import CourseNoteEditor from './CourseNoteEditor';
import AssignmentsTable from './AssignmentsTable';
import ComposeMessage from './ComposeMessage';
import MessageList from './MessageList';
import StudentReport from './StudentReport';
import { buildStudentRows } from '@/lib/studentReport';
import {
  canvasKeys,
  cacheStatus,
  useCanvasStatusQuery,
  useConfiguredAiIntegrationsQuery,
  useCourseAssignmentsQuery,
  useCourseMessagesQuery,
  useCourseStudentsQuery,
} from '@/lib/query/canvasQueries';

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
// just to jot down a quick note. Atividades/Alunos use the shared TanStack
// Query cache (ADR-0015, same keys TaskDetailModal's pickers read through
// canvasResolution.js): they paint at once from cache and revalidate in the
// background past the `volatile` tier, since both show live counters/grades.
export default function CourseWorkspaceTabs({ courseId, courseCode, initialTab, expandHref, onTabChange }) {
  const [tab, setTabState] = useState(TAB_KEYS.includes(initialTab) ? initialTab : 'notas');

  // The open tab must survive a trip to a drill-down page and back (see
  // BackButton.jsx): inline (CourseBrowser) the parent keeps it via
  // onTabChange; on the full page it lives in `?tab=`, written with a
  // history.replaceState (no server round trip, no new history entry) so
  // "Voltar" returns to /courses/[id]?tab=<this tab>.
  function setTab(key) {
    setTabState(key);
    onTabChange?.(key);
    if (!expandHref) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', key);
      window.history.replaceState(window.history.state, '', url);
    }
  }

  const assignmentsQuery = useCourseAssignmentsQuery(courseId, { enabled: tab === 'atividades' });
  const assignments = {
    data: assignmentsQuery.data ?? [],
    loading: cacheStatus(assignmentsQuery).initialLoading,
  };

  const studentsQuery = useCourseStudentsQuery(courseId, { enabled: tab === 'alunos' });
  const students = { data: studentsQuery.data ?? [], loading: cacheStatus(studentsQuery).initialLoading };
  const studentRows = useMemo(() => buildStudentRows(studentsQuery.data ?? []), [studentsQuery.data]);

  const queryClient = useQueryClient();
  const messagesQuery = useCourseMessagesQuery(courseId, { enabled: tab === 'mensagens' });
  const conversations = {
    data: messagesQuery.data?.conversations ?? [],
    loading: cacheStatus(messagesQuery).initialLoading,
    // Falha parcial vem no payload (200); falha total, como erro da consulta.
    error: messagesQuery.data?.loadError ?? (messagesQuery.data ? null : (messagesQuery.error?.message ?? null)),
  };

  // Arquivada no Canvas: some da lista já (cache). MessageList invalida a
  // caixa de entrada e os contadores.
  function handleArchived(conversationId) {
    queryClient.setQueryData(canvasKeys.courseMessages(courseId), (prev) =>
      prev ? { ...prev, conversations: prev.conversations.filter((c) => c.id !== conversationId) } : prev,
    );
  }

  // Mensagens and Alunos both need the professor's configured AI
  // integrations (reply/message suggestions) plus the Canvas session's
  // baseUrl/currentUserId — separate cached queries, enabled once either of
  // those two tabs is open. Failures degrade gracefully to empty defaults:
  // the AI picker just doesn't show up (same "integrations.length === 0"
  // branch ComposeMessage/MessageList/StudentReport already handle).
  const needsSession = tab === 'mensagens' || tab === 'alunos';
  const statusQuery = useCanvasStatusQuery({ enabled: needsSession });
  const integrationsQuery = useConfiguredAiIntegrationsQuery({ enabled: needsSession });
  const session = {
    baseUrl: statusQuery.data?.baseUrl || '',
    currentUserId: statusQuery.data?.providerUserId ? Number(statusQuery.data.providerUserId) : null,
    integrations: integrationsQuery.data ?? [],
  };

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
                onArchived={handleArchived}
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
