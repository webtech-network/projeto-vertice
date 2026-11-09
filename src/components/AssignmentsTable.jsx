'use client';

import { Fragment, useMemo, useState } from 'react';
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
export default function AssignmentsTable({ courseId, assignments }) {
  const [statusFilter, setStatusFilter] = useState('published');
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [sort, setSort] = useState({ key: null, direction: 'asc' });

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
      if (statusFilter === 'published' && !assignment.published) return false;
      if (statusFilter === 'unpublished' && assignment.published) return false;
      return true;
    });
  }, [assignments, statusFilter]);

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
                <th aria-sort={sortAria('pending')}>
                  <button
                    type="button"
                    className="th-sort-btn"
                    onClick={() => toggleSort('pending')}
                    title="Correções pendentes"
                  >
                    <ClipboardCheck size={16} strokeWidth={1.8} className="col-icon" aria-hidden="true" />
                    <span className="sr-only">Correções pendentes</span>
                    <SortIcon direction={sort.key === 'pending' ? sort.direction : null} />
                  </button>
                </th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((assignment) => {
                const expanded = expandedIds.has(assignment.id);
                return (
                  <Fragment key={assignment.id}>
                    <tr>
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
                    </tr>
                    {expanded && (
                      <tr className="message-detail-row">
                        <td colSpan={7}>
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
            </tbody>
          </table>
          </div>

          <ul className="icon-legend">
            <li>
              <CircleCheckBig size={14} strokeWidth={1.8} aria-hidden="true" style={{ color: 'var(--ok)' }} /> Publicado
            </li>
            <li>
              <CircleDashed size={14} strokeWidth={1.8} aria-hidden="true" /> Não publicado
            </li>
            <li>
              <ClipboardCheck size={14} strokeWidth={1.8} aria-hidden="true" /> Correções pendentes
            </li>
          </ul>
        </>
      )}
    </>
  );
}
