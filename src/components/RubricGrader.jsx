'use client';

import { invalidateAfterGrading } from '@/lib/query/invalidation';
import { Fragment, useMemo, useState } from 'react';
import {
  ChevronRight,
  Award,
  Eraser,
  Send,
  LoaderCircle,
  CircleCheckBig,
  CircleAlert,
  CircleDashed,
  Clock,
  Hourglass,
  FileCheck,
  HelpCircle,
} from 'lucide-react';
import {
  extractExistingSelections,
  computeTotalPoints,
  buildGradePayload,
  buildSimpleGradePayload,
  summarizeSubmissionStatus,
} from '@/lib/rubricGrading';
import { useUnsavedChangesGuard } from '@/lib/useUnsavedChangesGuard';
import SortIcon from './SortIcon';
import SubmissionPreview from './SubmissionPreview';

// Icon + color + a semantic (not alphabetical) sort order for the Status
// column — see summarizeSubmissionStatus() in rubricGrading.js for the
// exact label strings this is keyed by. Ordered so sorting ascending
// surfaces what most needs attention first (missing/late) before what's
// already handled (graded), mirroring CourseBrowser.jsx's own STATUS_ORDER
// approach for its status column.
const SUBMISSION_STATUS_META = {
  Faltando: { Icon: CircleAlert, color: 'var(--err)', order: 0 },
  'Não entregue': { Icon: CircleDashed, color: 'var(--ink-soft)', order: 1 },
  Atrasada: { Icon: Clock, color: 'var(--warn)', order: 2 },
  'Aguardando revisão': { Icon: Hourglass, color: 'var(--warn)', order: 3 },
  Entregue: { Icon: FileCheck, color: 'var(--ink)', order: 4 },
  Avaliada: { Icon: CircleCheckBig, color: 'var(--ok)', order: 5 },
};
const DEFAULT_STATUS_META = { Icon: HelpCircle, color: 'var(--ink-soft)', order: 99 };

// For a group assignment (see grade/page.jsx's own comment on
// `isGroupAssignment`), Canvas still returns one submission per *student* —
// grading one member's via the PUT route this component posts to is what
// propagates the same grade to the rest of their group, not anything this
// app does. So the row list itself has to collapse to one row per group
// here: keep only the first submission seen for each group.id (arbitrary
// but stable — it's just the representative whose user_id gets PUT to), and
// label the row with the group's name instead of that student's. A
// submission with no group (shouldn't normally happen for a real group
// assignment, but Canvas doesn't guarantee every enrolled student is
// grouped) falls back to showing as its own individual row.
//
// `grade` (a string, for controlled-input simplicity) is populated
// unconditionally from the submission's existing score — only actually used
// when there's no rubric (see `hasRubric` below), but harmless to always
// carry.
function buildInitialRows(submissions, groupAssignment) {
  let list = submissions.filter((s) => s.user_id);

  if (groupAssignment) {
    const seenGroupIds = new Set();
    list = list.filter((s) => {
      const groupId = s.group?.id;
      if (!groupId) return true;
      if (seenGroupIds.has(groupId)) return false;
      seenGroupIds.add(groupId);
      return true;
    });
  }

  return list
    .map((s) => ({
      userId: s.user_id,
      name: (groupAssignment && s.group?.name) || s.user?.name || `Aluno ${s.user_id}`,
      status: summarizeSubmissionStatus(s),
      hasSubmission: s.workflow_state !== 'unsubmitted',
      // Canvas returns a preview_url even for a student with no submission
      // (it just resolves to an empty-state page there) — SubmissionPreview.jsx
      // gates on `hasSubmission` too, not just this field being truthy, so
      // expanding a "Faltando" row shows a plain "nothing to see" message
      // instead of that empty-state page.
      previewUrl: s.preview_url || null,
      // SubmissionPreview.jsx picks its content source from
      // submissionType instead of always routing through Canvas's own
      // preview_url — confirmed in real use, Canvas frequently refuses to
      // be framed there at all (X-Frame-Options), for uploaded files just
      // as much as for the page itself. Each alternative sidesteps that in
      // a different way: an online_url submission's own link is an ordinary
      // external page with none of Canvas's auth/framing baggage; an
      // uploaded file's own attachment.url is a direct(ish) file link,
      // separate from the blocked preview wrapper page; text entered
      // directly into Canvas is already sitting right here in `body`,
      // needing no network request (or iframe) at all.
      submissionType: s.submission_type || null,
      submittedUrl: s.url || null,
      body: s.body || null,
      attachments: (s.attachments || []).map((a) => ({
        id: a.id,
        name: a.display_name || a.filename || `Arquivo ${a.id}`,
        url: a.url,
        contentType: a['content-type'] || '',
      })),
      selections: extractExistingSelections(s),
      grade: s.score != null ? String(s.score) : '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function bestRating(criterion) {
  return (criterion.ratings || []).reduce(
    (best, rating) => (rating.points > (best?.points ?? -Infinity) ? rating : best),
    null,
  );
}

// The single-table "go through every student in one sitting" dynamic ported
// from RubricTool — one row per student (or per group, see above), one
// <select> per rubric criterion — grades submitted to Canvas as a real,
// structured rubric_assessment (see src/lib/rubricGrading.js) instead of the
// ported tool's text-comment-only workaround. When the assignment has no
// rubric associated in Canvas at all (`rubric` is null/empty), this falls
// back to a single editable "Nota" column instead of the criteria grid —
// same row list, status, comment and actions, just a plain posted_grade
// instead of a rubric_assessment.
export default function RubricGrader({ courseId, assignmentId, rubric, pointsPossible, submissions, groupAssignment = false }) {
  const hasRubric = Array.isArray(rubric) && rubric.length > 0;
  const [rows, setRows] = useState(() => buildInitialRows(submissions, groupAssignment));
  const [comments, setComments] = useState({});
  const [rowState, setRowState] = useState({}); // { [userId]: { saving, error, saved } }
  const [hideMissing, setHideMissing] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  // userIds whose SubmissionPreview.jsx panel is expanded below their row —
  // same expand-a-row-below pattern as AssignmentsTable.jsx's own
  // expandedIds, a Set so more than one can be open at once.
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  // Same SORTERS/toggleSort/sortAria shape as CourseBrowser.jsx — only Nome
  // and Status are sortable here (the rubric criteria/Nota/Comentário
  // columns are per-row editable drafts, not stable sortable values).
  const [sort, setSort] = useState({ key: null, direction: 'asc' });
  // Rows touched since load/last successful send — drives the leave-page
  // warning below. Selections pre-filled from Canvas on load don't count as
  // dirty; only user-triggered edits do.
  const [dirtyRows, setDirtyRows] = useState(() => new Set());

  const entityLabel = groupAssignment ? 'grupo' : 'aluno';

  useUnsavedChangesGuard(dirtyRows.size > 0);

  const visibleRows = useMemo(() => (hideMissing ? rows.filter((r) => r.hasSubmission) : rows), [rows, hideMissing]);

  const sortedRows = useMemo(() => {
    if (!sort.key) return visibleRows;
    const getValue =
      sort.key === 'name'
        ? (r) => r.name?.toLowerCase() ?? ''
        : (r) => (SUBMISSION_STATUS_META[r.status] || DEFAULT_STATUS_META).order;
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...visibleRows].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });
  }, [visibleRows, sort]);

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

  function toggleExpanded(userId) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function rowHasGrade(row) {
    return hasRubric ? Object.keys(row.selections).length > 0 : row.grade !== '' && row.grade != null;
  }

  function markDirty(userId) {
    setDirtyRows((prev) => new Set(prev).add(userId));
  }

  function markClean(userId) {
    setDirtyRows((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }

  function updateSelection(userId, criterionId, rating) {
    markDirty(userId);
    setRows((prev) =>
      prev.map((r) => {
        if (r.userId !== userId) return r;
        const nextSelections = { ...r.selections };
        if (rating) {
          nextSelections[criterionId] = { ratingId: rating.id, points: rating.points, comments: '' };
        } else {
          delete nextSelections[criterionId];
        }
        return { ...r, selections: nextSelections };
      }),
    );
  }

  function updateGrade(userId, value) {
    markDirty(userId);
    setRows((prev) => prev.map((r) => (r.userId === userId ? { ...r, grade: value } : r)));
  }

  function maxGradeRow(row) {
    if (hasRubric) {
      const selections = {};
      for (const criterion of rubric) {
        const rating = bestRating(criterion);
        if (rating) selections[criterion.id] = { ratingId: rating.id, points: rating.points, comments: '' };
      }
      return { ...row, selections };
    }
    return { ...row, grade: pointsPossible != null ? String(pointsPossible) : row.grade };
  }

  function setMaxGrade(userId) {
    markDirty(userId);
    setRows((prev) => prev.map((r) => (r.userId === userId ? maxGradeRow(r) : r)));
  }

  // Bulk version of the per-row "Nota máxima" — applies full marks to every
  // currently visible row that actually has a submission, without touching
  // rows with nothing turned in. Still a local draft like every other
  // action here: nothing reaches Canvas until "Enviar todas as notas".
  function setMaxGradeForAllSubmitted() {
    const targets = visibleRows.filter((r) => r.hasSubmission);
    if (targets.length === 0) return;
    const targetIds = new Set(targets.map((r) => r.userId));
    setRows((prev) => prev.map((r) => (targetIds.has(r.userId) ? maxGradeRow(r) : r)));
    setDirtyRows((prev) => {
      const next = new Set(prev);
      targetIds.forEach((id) => next.add(id));
      return next;
    });
  }

  // Clearing discards the local draft entirely — since nothing was ever
  // sent to Canvas, there's nothing pending to lose, so this marks the row
  // clean (no yellow highlight) rather than dirty.
  function clearGrade(userId) {
    markClean(userId);
    setRows((prev) => prev.map((r) => (r.userId === userId ? { ...r, selections: {}, grade: '' } : r)));
  }

  function updateComment(userId, value) {
    markDirty(userId);
    setComments((prev) => ({ ...prev, [userId]: value }));
  }

  async function sendGrade(userId) {
    const row = rows.find((r) => r.userId === userId);
    if (!row) return;
    setRowState((prev) => ({ ...prev, [userId]: { saving: true, error: null, saved: false } }));
    try {
      const payload = hasRubric
        ? buildGradePayload(rubric, row.selections, computeTotalPoints(row.selections), comments[userId] || '')
        : buildSimpleGradePayload(Number(row.grade) || 0, comments[userId] || '');
      const response = await fetch(
        `/api/canvas/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao enviar a nota.');
      setRowState((prev) => ({ ...prev, [userId]: { saving: false, error: null, saved: true } }));
      setRows((prev) => prev.map((r) => (r.userId === userId ? { ...r, status: 'Avaliada' } : r)));
      invalidateAfterGrading(courseId);
      markClean(userId);
    } catch (err) {
      setRowState((prev) => ({ ...prev, [userId]: { saving: false, error: err.message, saved: false } }));
    }
  }

  async function sendAll() {
    const rowsToSend = visibleRows.filter(rowHasGrade);
    if (rowsToSend.length === 0) return;
    if (
      !window.confirm(
        `Enviar as notas de ${rowsToSend.length} ${entityLabel}(s) para o Canvas? Isso substitui a nota atual de cada um.`,
      )
    ) {
      return;
    }
    setBulkSending(true);
    setBulkError(null);
    // Sequential on purpose (ADR-0016: writes stay one-by-one) — per-row
    // progress and failures, and no write bursts against the rate limit.
    for (const row of rowsToSend) {
      await sendGrade(row.userId);
    }
    setBulkSending(false);
  }

  if (rows.length === 0) {
    return (
      <p className="lede">
        {groupAssignment ? 'Nenhum grupo com entrega nesta atividade.' : 'Nenhum aluno matriculado nesta atividade.'}
      </p>
    );
  }

  // Aluno/Grupo + Status + (rubric criteria + Nota, or a plain Nota column)
  // + Comentário + Ações — for the expanded SubmissionPreview row's colSpan.
  const columnCount = 2 + (hasRubric ? rubric.length + 1 : 1) + 2;

  return (
    <div className="rubric-grader">
      {!hasRubric && (
        <p className="alert alert-warning" role="alert">
          Esta atividade não possui rubrica associada no Canvas — lançando apenas a nota final.
        </p>
      )}

      <div className="browser-controls rubric-grader-toolbar">
        <label className="rubric-grader-filter">
          <input type="checkbox" checked={hideMissing} onChange={(e) => setHideMissing(e.target.checked)} />
          Ocultar sem entrega
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={setMaxGradeForAllSubmitted}
          title="Nota máxima para quem entregou"
          aria-label="Nota máxima para quem entregou"
        >
          <Award size={16} strokeWidth={1.8} />
          <span className="rubric-grader-toolbar-btn-text">Nota máxima para quem entregou</span>
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={bulkSending}
          onClick={sendAll}
          title={bulkSending ? 'Enviando…' : 'Enviar todas as notas'}
          aria-label={bulkSending ? 'Enviando notas' : 'Enviar todas as notas ao Canvas'}
        >
          {bulkSending ? <LoaderCircle size={16} strokeWidth={1.8} className="sync-spin" /> : <Send size={16} strokeWidth={1.8} />}
          <span className="rubric-grader-toolbar-btn-text">{bulkSending ? 'Enviando…' : 'Enviar todas as notas'}</span>
        </button>
      </div>

      {bulkError && (
        <p className="alert alert-error" role="alert">
          {bulkError}
        </p>
      )}

      {visibleRows.length === 0 ? (
        <p className="lede">{`Nenhum ${entityLabel} para exibir com esse filtro.`}</p>
      ) : (
        <div className="rubric-grader-table-wrap">
          <table className="data-table rubric-grader-table">
            <thead>
              <tr>
                <th aria-sort={sortAria('name')}>
                  <button type="button" className="th-sort-btn" onClick={() => toggleSort('name')}>
                    {groupAssignment ? 'Grupo' : 'Aluno'}
                    <SortIcon direction={sort.key === 'name' ? sort.direction : null} />
                  </button>
                </th>
                <th aria-sort={sortAria('status')}>
                  <button type="button" className="th-sort-btn" onClick={() => toggleSort('status')}>
                    Status
                    <SortIcon direction={sort.key === 'status' ? sort.direction : null} />
                  </button>
                </th>
                {hasRubric ? (
                  <>
                    {rubric.map((criterion) => (
                      <th key={criterion.id}>
                        {criterion.description} ({criterion.points} pts)
                      </th>
                    ))}
                    <th>Nota</th>
                  </>
                ) : (
                  <th>{pointsPossible != null ? `Nota (${pointsPossible} pts)` : 'Nota'}</th>
                )}
                <th>Comentário</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const state = rowState[row.userId] || {};
                const total = hasRubric ? computeTotalPoints(row.selections) : row.grade;
                const hasAnySelection = rowHasGrade(row);
                const isDirty = dirtyRows.has(row.userId);
                const expanded = expandedIds.has(row.userId);
                const statusMeta = SUBMISSION_STATUS_META[row.status] || DEFAULT_STATUS_META;
                const StatusIconCmp = statusMeta.Icon;
                return (
                  <Fragment key={row.userId}>
                  <tr className={isDirty ? 'is-dirty' : undefined}>
                    <td className="course-name-cell">
                      <button
                        type="button"
                        className="rubric-grader-name-toggle"
                        onClick={() => toggleExpanded(row.userId)}
                        aria-expanded={expanded}
                      >
                        <span className={`group-chevron${expanded ? ' expanded' : ''}`} aria-hidden="true">
                          <ChevronRight size={14} strokeWidth={2} />
                        </span>
                        {row.name}
                      </button>
                    </td>
                    <td className="status-cell">
                      <span className="status-icon" style={{ color: statusMeta.color }} title={row.status} role="img" aria-label={row.status}>
                        <StatusIconCmp size={16} strokeWidth={1.8} />
                      </span>
                    </td>
                    {hasRubric ? (
                      <>
                        {rubric.map((criterion) => {
                          const sel = row.selections[criterion.id];
                          return (
                            <td key={criterion.id}>
                              <select
                                aria-label={`${criterion.description} — ${row.name}`}
                                value={sel?.ratingId || ''}
                                onChange={(e) => {
                                  const rating = criterion.ratings?.find((r) => r.id === e.target.value);
                                  updateSelection(row.userId, criterion.id, rating || null);
                                }}
                              >
                                <option value="">—</option>
                                {criterion.ratings?.map((rating) => (
                                  <option key={rating.id} value={rating.id}>
                                    {rating.description} ({rating.points})
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
                        <td className="rubric-grader-total">{total}</td>
                      </>
                    ) : (
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={pointsPossible ?? undefined}
                          step="any"
                          aria-label={`Nota — ${row.name}`}
                          value={row.grade}
                          onChange={(e) => updateGrade(row.userId, e.target.value)}
                          placeholder="Nota"
                        />
                      </td>
                    )}
                    <td className="rubric-grader-comment-cell">
                      <textarea
                        rows={2}
                        value={comments[row.userId] || ''}
                        onChange={(e) => updateComment(row.userId, e.target.value)}
                        placeholder="Comentário para o aluno…"
                      />
                    </td>
                    <td className="actions-cell rubric-grader-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-icon"
                        onClick={() => setMaxGrade(row.userId)}
                        title="Nota máxima"
                        aria-label={`Nota máxima para ${row.name}`}
                      >
                        <Award size={14} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-icon"
                        onClick={() => clearGrade(row.userId)}
                        title="Limpar"
                        aria-label={`Limpar nota de ${row.name}`}
                      >
                        <Eraser size={14} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-icon"
                        disabled={state.saving || !hasAnySelection}
                        onClick={() => sendGrade(row.userId)}
                        title={state.saving ? 'Enviando…' : state.saved ? 'Enviado ✓' : 'Enviar nota ao Canvas'}
                        aria-label={
                          state.saving ? 'Enviando nota' : state.saved ? 'Nota enviada' : `Enviar nota de ${row.name} ao Canvas`
                        }
                      >
                        {state.saving ? (
                          <LoaderCircle size={14} strokeWidth={1.8} className="sync-spin" />
                        ) : state.saved ? (
                          <CircleCheckBig size={14} strokeWidth={1.8} />
                        ) : (
                          <Send size={14} strokeWidth={1.8} />
                        )}
                      </button>
                      {state.error && (
                        <p className="alert alert-error" role="alert">
                          {state.error}
                        </p>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="message-detail-row">
                      <td colSpan={columnCount}>
                        <div className="message-detail">
                          <SubmissionPreview
                            studentName={row.name}
                            hasSubmission={row.hasSubmission}
                            previewUrl={row.previewUrl}
                            submissionType={row.submissionType}
                            submittedUrl={row.submittedUrl}
                            body={row.body}
                            attachments={row.attachments}
                          />
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
      )}
    </div>
  );
}
