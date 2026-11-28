'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  ListPlus,
  CircleCheckBig,
  CircleDashed,
  ExternalLink,
  Shuffle,
  Scale,
} from 'lucide-react';
import StatusIcon from './StatusIcon';
import SortIcon from './SortIcon';
import { useViewRole } from './ViewRoleProvider';

function formatDueDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function isPastDue(iso) {
  if (!iso) return false;
  const dueAt = new Date(iso);
  return !Number.isNaN(dueAt.getTime()) && dueAt.getTime() < Date.now();
}

// Preview-only plain-text rendering of the assignment's HTML description —
// same reasoning as QuestionGenerator.jsx's stripHtml: this app has zero
// HTML-sanitization tooling, so raw Canvas HTML is never injected via
// dangerouslySetInnerHTML. Joins top-level block elements (paragraphs,
// lists, etc.) with blank lines so multi-paragraph descriptions don't run
// together into one unreadable line.
function descriptionToPlainText(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = doc.body.children.length > 0 ? Array.from(doc.body.children) : [doc.body];
  return blocks
    .map((el) => el.textContent.trim())
    .filter(Boolean)
    .join('\n\n');
}

const STATUS_FILTERS = [
  { key: 'published', label: 'Publicadas' },
  { key: 'unpublished', label: 'Não publicadas' },
  { key: 'all', label: 'Todas' },
];

// Same shape as CourseBrowser.jsx's own SORTERS/toggleSort/sortAria trio —
// a missing value sorts as the lowest possible one (-1) so it lands first
// ascending / last descending, consistent with that component's convention.
const SORTERS = {
  status: (a) => (a.published ? 0 : 1),
  name: (a) => a.name?.toLowerCase() ?? '',
  points: (a) => a.points_possible ?? -1,
  dueDate: (a) => (a.due_at ? new Date(a.due_at).getTime() : -1),
  pending: (a) => a.needs_grading_count ?? 0,
};

// Defaults to "Publicadas" — same convention as CourseBrowser.jsx's own
// status filter (unpublished items usually aren't what a professor is
// looking for on first load; "Todas" is still one click away).
export default function AssignmentsTable({ courseId, assignments, focusNearest = false }) {
  const { isStudentView } = useViewRole();
  const [statusFilter, setStatusFilter] = useState('published');
  const focusedRef = useRef(false);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [sort, setSort] = useState({ key: null, direction: 'asc' });

  const effectiveStatusFilter = isStudentView ? 'published' : statusFilter;
  const colSpanCount = isStudentView ? 5 : 7;

  function toggleExpanded(assignmentId) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  }

  const publishedCount = useMemo(() => assignments.filter((a) => a.published).length, [assignments]);
  const unpublishedCount = assignments.length - publishedCount;

  const filtered = useMemo(() => {
    return assignments.filter((assignment) => {
      if (effectiveStatusFilter === 'published' && !assignment.published) return false;
      if (effectiveStatusFilter === 'unpublished' && assignment.published) return false;
      return true;
    });
  }, [assignments, effectiveStatusFilter]);

  // Atividade com a data de entrega mais próxima de agora: a próxima a vencer;
  // sem nenhuma futura, a vencida mais recente. Usada quando se chega pelas
  // pendências do curso (focusNearest).
  const nearestId = useMemo(() => {
    const now = Date.now();
    let upcoming = null;
    let past = null;
    for (const a of filtered) {
      if (!a.due_at) continue;
      const t = new Date(a.due_at).getTime();
      if (Number.isNaN(t)) continue;
      if (t >= now) {
        if (!upcoming || t < upcoming.t) upcoming = { id: a.id, t };
      } else if (!past || t > past.t) {
        past = { id: a.id, t };
      }
    }
    return (upcoming ?? past)?.id ?? null;
  }, [filtered]);

  useEffect(() => {
    if (!focusNearest || focusedRef.current || nearestId == null) return;
    const row = document.querySelector(`[data-assignment-row="${nearestId}"]`);
    if (!row) return;
    focusedRef.current = true;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const getValue = SORTERS[sort.key];
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });
  }, [filtered, sort]);

  // Ordem padrão (sem ordenação manual): primeiro o que ainda vai vencer, da
  // entrega mais próxima de hoje até a mais distante; depois as sem data; e,
  // numa camada separada abaixo, as já encerradas (prazo vencido), da mais
  // recente para a mais antiga. Ordenar por uma coluna volta à lista única.
  // Racional: specs/decisions/0023-ordem-cronologica-no-curso.md.
  const groups = useMemo(() => {
    if (sort.key) return [{ key: 'all', label: null, items: sorted }];
    const now = Date.now();
    const time = (a) => (a.due_at ? new Date(a.due_at).getTime() : NaN);
    const upcoming = [];
    const undated = [];
    const closed = [];
    for (const a of filtered) {
      const t = time(a);
      if (Number.isNaN(t)) undated.push(a);
      else if (t >= now) upcoming.push(a);
      else closed.push(a);
    }
    upcoming.sort((a, b) => time(a) - time(b));
    closed.sort((a, b) => time(b) - time(a));
    const result = [{ key: 'open', label: null, items: [...upcoming, ...undated] }];
    if (closed.length) result.push({ key: 'closed', label: `Já encerradas (${closed.length})`, items: closed });
    return result;
  }, [filtered, sorted, sort.key]);

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }

  function sortAria(key) {
    if (sort.key !== key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  if (assignments.length === 0) {
    return <p>Nenhuma atividade encontrada neste curso.</p>;
  }

  return (
    <>
      {!isStudentView && (
        <div className="browser-controls">
          <div className="segmented" role="group" aria-label="Filtrar por status de publicação">
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`segmented-btn${statusFilter === key ? ' active' : ''}`}
                onClick={() => setStatusFilter(key)}
              >
                {label} ({key === 'all' ? assignments.length : key === 'published' ? publishedCount : unpublishedCount})
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="lede">Nenhuma atividade encontrada com esse filtro.</p>
      ) : (
        <>
          <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <span className="sr-only">Expandir</span>
                </th>
                <th aria-sort={sortAria('status')}>
                  <button type="button" className="th-sort-btn" onClick={() => toggleSort('status')} title="Status de publicação">
                    <span className="sr-only">Status</span>
                    <SortIcon direction={sort.key === 'status' ? sort.direction : null} />
                  </button>
                </th>
                <th aria-sort={sortAria('name')}>
                  <button type="button" className="th-sort-btn" onClick={() => toggleSort('name')}>
                    Atividade
                    <SortIcon direction={sort.key === 'name' ? sort.direction : null} />
                  </button>
                </th>
                <th aria-sort={sortAria('points')}>
                  <button type="button" className="th-sort-btn" onClick={() => toggleSort('points')}>
                    Valor
                    <SortIcon direction={sort.key === 'points' ? sort.direction : null} />
                  </button>
                </th>
                <th aria-sort={sortAria('dueDate')}>
                  <button type="button" className="th-sort-btn" onClick={() => toggleSort('dueDate')}>
                    Data de entrega
                    <SortIcon direction={sort.key === 'dueDate' ? sort.direction : null} />
                  </button>
                </th>
                {!isStudentView && (
                  <>
                    <th aria-sort={sortAria('pending')}>
                      <button
                        type="button"
                        className="th-sort-btn"
                        onClick={() => toggleSort('pending')}
                        title="Pendências (a corrigir)"
                      >
                        <ClipboardCheck size={16} strokeWidth={1.8} className="col-icon" aria-hidden="true" />
                        <span className="sr-only">Pendências (a corrigir)</span>
                        <SortIcon direction={sort.key === 'pending' ? sort.direction : null} />
                      </button>
                    </th>
                    <th>Ações</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
              <Fragment key={group.key}>
              {group.label && (
                <tr className="group-divider-row">
                  <td colSpan={colSpanCount}>{group.label}</td>
                </tr>
              )}
              {group.items.map((assignment) => {
                const expanded = expandedIds.has(assignment.id);
                return (
                  <Fragment key={assignment.id}>
                    <tr
                      data-assignment-row={assignment.id}
                      className={
                        [
                          focusNearest && assignment.id === nearestId && 'is-focused-row',
                          group.key === 'closed' && 'is-closed-row',
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                    >
                      <td className="expand-cell">
                        <button
                          type="button"
                          className="row-expand-btn"
                          onClick={() => toggleExpanded(assignment.id)}
                          aria-expanded={expanded}
                          aria-label={expanded ? 'Recolher enunciado' : 'Expandir enunciado'}
                        >
                          <span className={`group-chevron${expanded ? ' expanded' : ''}`} aria-hidden="true">
                            <ChevronRight size={16} strokeWidth={2} />
                          </span>
                        </button>
                      </td>
                      <td className="status-cell">
                        <StatusIcon status={assignment.published ? 'published' : 'unpublished'} />
                      </td>
                      <td className="course-name-cell">
                        <button
                          type="button"
                          className="subject-toggle-btn"
                          onClick={() => toggleExpanded(assignment.id)}
                          aria-expanded={expanded}
                        >
                          {assignment.name}
                        </button>
                        <a
                          href={assignment.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link-icon"
                          title="Abrir atividade no Canvas"
                          aria-label="Abrir atividade no Canvas"
                        >
                          <ExternalLink size={14} strokeWidth={1.8} />
                        </a>
                      </td>
                      <td className="pending-cell">
                        {assignment.points_possible != null ? `${assignment.points_possible} pts` : '—'}
                      </td>
                      <td className={`pending-cell${isPastDue(assignment.due_at) ? ' is-past-due' : ''}`}>
                        {formatDueDate(assignment.due_at)}
                      </td>
                      {!isStudentView && (
                        <>
                          <td className="pending-cell">
                            {assignment.needs_grading_count ? (
                              <span className="pending-badge has-pending">{assignment.needs_grading_count}</span>
                            ) : null}
                          </td>
                          <td className="actions-cell">
                            {/* Always shown — unlike quiz_id, whether an assignment has
                                a rubric isn't known from this list response, so the
                                grading page itself handles the "sem rubrica" case. */}
                            <Link
                              href={`/courses/${courseId}/assignments/${assignment.id}/grade`}
                              className="btn btn-primary btn-icon"
                              title="Correção de Atividade"
                              aria-label="Correção de Atividade"
                            >
                              <ClipboardList size={18} strokeWidth={1.8} />
                            </Link>
                            {/* Only classic quizzes (assignment.quiz_id) can receive imported
                                questions — New Quizzes (is_quiz_assignment) and regular
                                assignments intentionally get no action here. */}
                            {assignment.quiz_id && (
                              <Link
                                href={`/courses/${courseId}/quizzes/${assignment.quiz_id}/import`}
                                className="btn btn-primary btn-icon"
                                title="Importar questões"
                                aria-label="Importar questões"
                              >
                                <ListPlus size={18} strokeWidth={1.8} />
                              </Link>
                            )}
                            {/* Only assignments with peer review enabled — distributes
                                reviewers across the course's groups (see
                                specs/capabilities/peer-review-distribution.md). */}
                            {assignment.peer_reviews && (
                              <Link
                                href={`/courses/${courseId}/assignments/${assignment.id}/peer-reviews`}
                                className="btn btn-primary btn-icon"
                                title="Distribuir avaliação por pares"
                                aria-label="Distribuir avaliação por pares"
                              >
                                <Shuffle size={18} strokeWidth={1.8} />
                              </Link>
                            )}
                            {/* Same condition — consolidates the peers' grades/comments
                                into a final grade (specs/capabilities/peer-review-grading.md). */}
                            {assignment.peer_reviews && (
                              <Link
                                href={`/courses/${courseId}/assignments/${assignment.id}/peer-grading`}
                                className="btn btn-primary btn-icon"
                                title="Consolidar avaliação por pares"
                                aria-label="Consolidar avaliação por pares"
                              >
                                <Scale size={18} strokeWidth={1.8} />
                              </Link>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                    {expanded && (
                      <tr className="message-detail-row">
                        <td colSpan={colSpanCount}>
                          <div className="message-detail">
                            {assignment.description ? (
                              <p className="message-detail-text">{descriptionToPlainText(assignment.description)}</p>
                            ) : (
                              <p className="lede">Esta atividade não tem enunciado.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              </Fragment>
              ))}
            </tbody>
          </table>
          </div>

          <ul className="icon-legend">
            <li>
              <CircleCheckBig size={14} strokeWidth={1.8} aria-hidden="true" style={{ color: 'var(--ok)' }} /> Publicado
            </li>
            {!isStudentView && (
              <>
                <li>
                  <CircleDashed size={14} strokeWidth={1.8} aria-hidden="true" /> Não publicado
                </li>
                <li>
                  <ClipboardCheck size={14} strokeWidth={1.8} aria-hidden="true" /> Pendências (a corrigir)
                </li>
              </>
            )}
          </ul>
        </>
      )}
    </>
  );
}
