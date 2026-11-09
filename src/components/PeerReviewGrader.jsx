'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  CircleMinus,
  CircleX,
  Clock,
  Copy,
  Eraser,
  EyeOff,
  Gavel,
  LoaderCircle,
  RotateCcw,
  Send,
  TriangleAlert,
  Undo2,
} from 'lucide-react';
import SortIcon from './SortIcon';
import SubmissionPreview from './SubmissionPreview';
import { useUnsavedChangesGuard } from '@/lib/useUnsavedChangesGuard';
import { buildSimpleGradePayload } from '@/lib/rubricGrading';
import {
  PENALTY_MODES,
  applyDiscards,
  buildPeerGradeComment,
  dispersionLevel,
  isCarelessReview,
  computeFinalGrade,
  formatPoints,
  suggestPenalty,
  validateGrade,
} from '@/lib/peerReviewGrading';

const STATUS_META = {
  missing: { label: 'Não entregou', Icon: CircleX, color: 'var(--err)' },
  unreviewed: { label: 'Sem avaliação dos pares', Icon: CircleAlert, color: 'var(--warn)' },
  partial: { label: 'Revisões pendentes', Icon: Clock, color: 'var(--warn)' },
  ok: { label: 'Avaliação completa', Icon: CircleCheckBig, color: 'var(--ok)' },
  excused: { label: 'Dispensado', Icon: CircleMinus, color: 'var(--ink-soft)' },
};

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'missing', label: 'Não entregou' },
  { key: 'unreviewed', label: 'Sem avaliação' },
  { key: 'partial', label: 'Revisões pendentes' },
  { key: 'ok', label: 'OK' },
  { key: 'penalized', label: 'Penalizados' },
  { key: 'divergent', label: 'Notas divergentes' },
];

// Colour of the "Desvio" badge — see dispersionLevel().
const DISPERSION_META = {
  warn: { label: 'Desvio alto', color: 'var(--warn)' },
  high: { label: 'Desvio muito alto', color: 'var(--err)' },
};

const SORTERS = {
  name: (s) => s.name.toLowerCase(),
  group: (s) => s.groupName?.toLowerCase() ?? '~',
  average: (s) => s.average ?? -1,
  stdDev: (s) => s.stdDev ?? -1,
};

function initialRowState(students) {
  return Object.fromEntries(
    students.map((s) => [
      s.userId,
      {
        grade: s.currentScore != null ? String(s.currentScore) : '',
        // 'canvas' (came from Canvas) | 'auto' (filled by "Copiar médias",
        // follows the row's penalty) | 'manual' (typed — never overwritten).
        source: s.currentScore != null ? 'canvas' : 'auto',
        penaltyOn: false,
        penalty: '',
        comment: '',
        dirty: false,
      },
    ]),
  );
}

function normalizeName(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// See specs/capabilities/peer-review-grading.md. Everything stays in memory
// until a send; sends go through the existing per-student PUT route, one
// request at a time (never Promise.all).
export default function PeerReviewGrader({
  courseId,
  assignmentId,
  pointsPossible,
  rubricPoints,
  hasRubric,
  totals,
  students: baseStudents,
  categories,
  defaultCategoryId,
  initialGroups,
}) {
  const [rows, setRows] = useState(() => initialRowState(baseStudents));
  const [sendState, setSendState] = useState({}); // { [userId]: { saving, error, saved } }
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' });
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const [penaltyConfig, setPenaltyConfig] = useState({
    text: 'Penalidade por falta de participação na avaliação por pares',
    points: String(Math.min(3, pointsPossible ?? 3)),
    mode: PENALTY_MODES.ALL_OR_NOTHING,
    requireComment: true,
  });

  // Careless reviews the professor chose to ignore (reviewKey()s) — they
  // leave the reviewee's average and count as not done for the reviewer.
  const [discarded, setDiscarded] = useState(() => new Set());
  const [quality, setQuality] = useState({
    minCommentLength: '20',
    threshold: '15', // % of the assignment's points
    discardedText: 'Avaliação por pares desconsiderada: nota máxima sem justificativa adequada',
  });

  const students = useMemo(() => applyDiscards(baseStudents, discarded, { hasRubric }), [baseStudents, discarded, hasRubric]);

  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [groupsByCategory, setGroupsByCategory] = useState(() =>
    defaultCategoryId ? { [defaultCategoryId]: initialGroups } : {},
  );
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState(null);

  const [bulk, setBulk] = useState(null); // { done, total } while sending
  const [failures, setFailures] = useState([]); // [{ userId, error }]

  const dirtyCount = Object.values(rows).filter((r) => r.dirty).length;
  useUnsavedChangesGuard(dirtyCount > 0);

  const studentById = useMemo(() => new Map(students.map((s) => [s.userId, s])), [students]);

  const isSuspect = (review) =>
    isCarelessReview(review, { rubricPoints, minCommentLength: quality.minCommentLength });
  const thresholdRatio = (Number(quality.threshold) || 0) / 100;
  const levelOf = (s) => dispersionLevel(s.stdDev, pointsPossible, thresholdRatio);

  const allReviews = useMemo(() => students.flatMap((s) => s.received), [students]);
  const pendingSuspects = allReviews.filter((r) => !r.discarded && isSuspect(r));
  const suspectCount = allReviews.filter(isSuspect).length;

  // --- Groups --------------------------------------------------------------

  async function selectCategory(nextId) {
    const id = nextId ? Number(nextId) : null;
    setCategoryId(id);
    setGroupsError(null);
    if (!id || groupsByCategory[id]) return;
    setLoadingGroups(true);
    try {
      const response = await fetch(`/api/canvas/courses/${courseId}/group-categories/${id}/groups`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao carregar os grupos.');
      setGroupsByCategory((prev) => ({ ...prev, [id]: data.groups }));
    } catch (err) {
      setGroupsError(err.message);
    } finally {
      setLoadingGroups(false);
    }
  }

  const groupNameOf = useMemo(() => {
    const map = new Map();
    for (const group of (categoryId && groupsByCategory[categoryId]) || []) {
      for (const memberId of group.memberIds) map.set(memberId, group.name);
    }
    return map;
  }, [categoryId, groupsByCategory]);

  // --- Row edits -----------------------------------------------------------

  function patchRow(userId, patch) {
    setRows((prev) => {
      const current = prev[userId];
      const next = { ...current, ...patch, dirty: true };
      // An auto-filled grade follows its row's penalty; a typed one never moves.
      if (next.source === 'auto' && ('penaltyOn' in patch || 'penalty' in patch)) {
        const final = computeFinalGrade(studentById.get(userId).suggested, next.penaltyOn ? next.penalty : 0);
        if (final != null && current.grade !== '') next.grade = String(final);
      }
      return { ...prev, [userId]: next };
    });
    setSendState((prev) => ({ ...prev, [userId]: { ...prev[userId], saved: false } }));
  }

  function copyAverages() {
    setRows((prev) => {
      const next = { ...prev };
      for (const s of students) {
        const row = prev[s.userId];
        if (row.grade !== '') continue; // only empty fields, like the legacy tool
        const final = computeFinalGrade(s.suggested, row.penaltyOn ? row.penalty : 0);
        if (final == null) continue;
        next[s.userId] = { ...row, grade: String(final), source: 'auto', dirty: true };
      }
      return next;
    });
  }

  function clearGrades() {
    if (!window.confirm('Limpar todas as notas da tabela? Nada é alterado no Canvas até você enviar.')) return;
    setRows((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, row]) => [id, { ...row, grade: '', source: 'auto', dirty: row.dirty || row.grade !== '' }]),
      ),
    );
  }

  function applyPenalties() {
    setRows((prev) => {
      const next = { ...prev };
      for (const s of students) {
        const pts = suggestPenalty(s.participation, {
          mode: penaltyConfig.mode,
          points: penaltyConfig.points,
          requireComment: penaltyConfig.requireComment,
        });
        if (pts <= 0) continue;
        const row = { ...prev[s.userId], penaltyOn: true, penalty: String(pts), dirty: true };
        if (row.source === 'auto' && row.grade !== '') {
          const final = computeFinalGrade(s.suggested, pts);
          if (final != null) row.grade = String(final);
        }
        next[s.userId] = row;
      }
      return next;
    });
  }

  // --- Careless reviews ----------------------------------------------------

  function setDiscard(keys, on) {
    const nextSet = new Set(discarded);
    for (const key of keys) {
      if (on) nextSet.add(key);
      else nextSet.delete(key);
    }
    const nextStudents = applyDiscards(baseStudents, nextSet, { hasRubric });
    const nextById = new Map(nextStudents.map((s) => [s.userId, s]));
    // Both ends of each review change: the reviewee's average and the
    // reviewer's participation (and the note in their comment).
    const affected = new Set(
      allReviews.filter((r) => keys.includes(r.key)).flatMap((r) => [r.revieweeId, r.reviewerId]),
    );
    setDiscarded(nextSet);
    setRows((prev) => {
      const next = { ...prev };
      for (const userId of affected) {
        const row = { ...prev[userId], dirty: true };
        if (row.source === 'auto' && row.grade !== '') {
          const final = computeFinalGrade(nextById.get(userId).suggested, row.penaltyOn ? row.penalty : 0);
          row.grade = final != null ? String(final) : '';
        }
        next[userId] = row;
      }
      return next;
    });
    setSendState((prev) => {
      const next = { ...prev };
      for (const userId of affected) next[userId] = { ...prev[userId], saved: false };
      return next;
    });
  }

  function discardSuspects() {
    if (pendingSuspects.length === 0) return;
    setDiscard(
      pendingSuspects.map((r) => r.key),
      true,
    );
  }

  const penaltyPreview = useMemo(
    () =>
      students.filter(
        (s) =>
          suggestPenalty(s.participation, {
            mode: penaltyConfig.mode,
            points: penaltyConfig.points,
            requireComment: penaltyConfig.requireComment,
          }) > 0,
      ).length,
    [students, penaltyConfig],
  );

  // --- Sending -------------------------------------------------------------

  async function sendOne(userId) {
    const row = rows[userId];
    const check = validateGrade(row.grade, pointsPossible);
    if (check.empty || !check.valid) return false;
    setSendState((prev) => ({ ...prev, [userId]: { saving: true, error: null, saved: false } }));
    try {
      const comment = buildPeerGradeComment({
        comment: row.comment,
        penaltyOn: row.penaltyOn,
        penaltyPoints: row.penalty,
        penaltyText: penaltyConfig.text,
        discardedCount: studentById.get(userId).participation.discarded,
        discardedText: quality.discardedText,
      });
      const response = await fetch(`/api/canvas/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSimpleGradePayload(Number(row.grade), comment)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Falha (${response.status}).`);
      setSendState((prev) => ({ ...prev, [userId]: { saving: false, error: null, saved: true } }));
      setRows((prev) => ({ ...prev, [userId]: { ...prev[userId], dirty: false } }));
      return true;
    } catch (err) {
      setSendState((prev) => ({ ...prev, [userId]: { saving: false, error: err.message, saved: false } }));
      throw err;
    }
  }

  async function runBulk(userIds) {
    setFailures([]);
    setBulk({ done: 0, total: userIds.length });
    const failed = [];
    // Sequential, not Promise.all — same concurrent-Canvas-call race this
    // app avoids on every other multi-request flow.
    for (let i = 0; i < userIds.length; i += 1) {
      try {
        await sendOne(userIds[i]);
      } catch (err) {
        failed.push({ userId: userIds[i], error: err.message });
      }
      setBulk({ done: i + 1, total: userIds.length });
    }
    setFailures(failed);
    setBulk(null);
  }

  const sendable = students
    .map((s) => s.userId)
    .filter((id) => {
      const row = rows[id];
      const check = validateGrade(row.grade, pointsPossible);
      return row.dirty && !check.empty && check.valid;
    });

  function sendAll() {
    if (sendable.length === 0) return;
    if (
      !window.confirm(
        `Enviar ${sendable.length} nota(s) alterada(s) ao Canvas? Isso substitui a nota atual de cada aluno e envia os comentários.`,
      )
    ) {
      return;
    }
    runBulk(sendable);
  }

  // --- View ----------------------------------------------------------------

  const counts = useMemo(() => {
    const c = { all: students.length, missing: 0, unreviewed: 0, partial: 0, ok: 0, penalized: 0, divergent: 0 };
    for (const s of students) {
      if (c[s.status] != null) c[s.status] += 1;
      if (rows[s.userId].penaltyOn) c.penalized += 1;
      const level = dispersionLevel(s.stdDev, pointsPossible, thresholdRatio);
      if (level === 'warn' || level === 'high') c.divergent += 1;
    }
    return c;
  }, [students, rows, pointsPossible, thresholdRatio]);

  const visible = useMemo(() => {
    const query = normalizeName(search.trim());
    const list = students
      .map((s) => ({ ...s, groupName: groupNameOf.get(s.userId) ?? null }))
      .filter((s) => {
        if (filter === 'penalized') return rows[s.userId].penaltyOn;
        if (filter === 'divergent') {
          const level = dispersionLevel(s.stdDev, pointsPossible, thresholdRatio);
          return level === 'warn' || level === 'high';
        }
        return filter === 'all' || s.status === filter;
      })
      .filter((s) => !query || normalizeName(s.name).includes(query));
    const getValue = SORTERS[sort.key];
    const sign = sort.direction === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [students, groupNameOf, filter, search, sort, rows, pointsPossible, thresholdRatio]);

  function toggleSort(key) {
    setSort((prev) =>
      prev.key !== key ? { key, direction: 'asc' } : { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' },
    );
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

  const delivered = students.filter((s) => s.status !== 'missing' && s.status !== 'excused').length;
  const scaled = hasRubric && rubricPoints != null && pointsPossible != null && rubricPoints !== pointsPossible;
  const busy = bulk != null;
  const COLUMN_COUNT = 11;

  return (
    <div className="peer-grader">
      {!hasRubric && (
        <p className="alert alert-warning" role="alert">
          Esta atividade não tem rubrica no Canvas, então os pares não deram nota. A tabela mostra só a participação e os
          comentários, e todas as notas são lançadas manualmente.
        </p>
      )}
      {scaled && (
        <p className="alert alert-info">
          A rubrica vale {formatPoints(rubricPoints)} pts e a atividade vale {formatPoints(pointsPossible)} pts. As médias
          já estão convertidas para o valor da atividade.
        </p>
      )}

      <div className="stat-tile-grid peer-review-stats">
        <div className="stat-tile">
          <span className="stat-tile-label">Entregas</span>
          <span className="stat-tile-value">{delivered}</span>
          <span className="stat-tile-sub">de {students.length} alunos</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-label">Revisões concluídas</span>
          <span className="stat-tile-value">{totals.completed}</span>
          <span className="stat-tile-sub">de {totals.assigned} atribuídas</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-label">Sem avaliação</span>
          <span className="stat-tile-value">{counts.unreviewed}</span>
          <span className="stat-tile-sub">precisam de nota manual</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-label">Desconsideradas</span>
          <span className="stat-tile-value">{discarded.size}</span>
          <span className="stat-tile-sub">
            {suspectCount} suspeita(s) de descuido
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-label">Alterações</span>
          <span className="stat-tile-value">{dirtyCount}</span>
          <span className="stat-tile-sub">não enviadas</span>
        </div>
      </div>

      <fieldset className="peer-grader-penalty">
        <legend>Penalidade por falta de participação</legend>
        <div className="peer-grader-penalty-fields">
          <label className="peer-review-field peer-grader-penalty-text">
            Comentário enviado ao aluno
            <input
              type="text"
              value={penaltyConfig.text}
              onChange={(e) => setPenaltyConfig((p) => ({ ...p, text: e.target.value }))}
            />
          </label>
          <label className="peer-review-field">
            Pontos
            <input
              type="number"
              min={0}
              max={pointsPossible ?? undefined}
              step="any"
              value={penaltyConfig.points}
              onChange={(e) => setPenaltyConfig((p) => ({ ...p, points: e.target.value }))}
            />
          </label>
          <div className="peer-review-field">
            Cálculo
            <div className="segmented" role="group" aria-label="Modo de cálculo da penalidade">
              <button
                type="button"
                className={`segmented-btn${penaltyConfig.mode === PENALTY_MODES.ALL_OR_NOTHING ? ' active' : ''}`}
                onClick={() => setPenaltyConfig((p) => ({ ...p, mode: PENALTY_MODES.ALL_OR_NOTHING }))}
                title="Pontos cheios para quem não fez nenhuma revisão"
              >
                Tudo ou nada
              </button>
              <button
                type="button"
                className={`segmented-btn${penaltyConfig.mode === PENALTY_MODES.PROPORTIONAL ? ' active' : ''}`}
                onClick={() => setPenaltyConfig((p) => ({ ...p, mode: PENALTY_MODES.PROPORTIONAL }))}
                title="Pontos × revisões não feitas ÷ revisões atribuídas"
              >
                Proporcional
              </button>
            </div>
          </div>
          <label className="checkbox-filter">
            <input
              type="checkbox"
              checked={penaltyConfig.requireComment}
              onChange={(e) => setPenaltyConfig((p) => ({ ...p, requireComment: e.target.checked }))}
            />
            Revisão sem comentário conta como não feita
          </label>
          <button type="button" className="btn btn-secondary" onClick={applyPenalties} disabled={busy || penaltyPreview === 0}>
            <Gavel size={16} strokeWidth={1.8} />
            Aplicar penalidades ({penaltyPreview})
          </button>
        </div>
      </fieldset>

      <fieldset className="peer-grader-penalty">
        <legend>Qualidade das avaliações</legend>
        <div className="peer-grader-penalty-fields">
          <label className="peer-review-field" title="Nota máxima com comentários mais curtos que isto é marcada como suspeita">
            Comentário mínimo (caracteres)
            <input
              type="number"
              min={0}
              step={1}
              value={quality.minCommentLength}
              onChange={(e) => setQuality((q) => ({ ...q, minCommentLength: e.target.value }))}
            />
          </label>
          <label
            className="peer-review-field"
            title="Desvio padrão das notas recebidas, em % do valor da atividade. Amarelo a partir deste valor, vermelho a partir do dobro."
          >
            Desvio alto a partir de (%)
            <input
              type="number"
              min={1}
              max={100}
              step="any"
              value={quality.threshold}
              onChange={(e) => setQuality((q) => ({ ...q, threshold: e.target.value }))}
            />
          </label>
          <label className="peer-review-field peer-grader-penalty-text">
            Comentário ao avaliador com avaliação desconsiderada
            <input
              type="text"
              value={quality.discardedText}
              onChange={(e) => setQuality((q) => ({ ...q, discardedText: e.target.value }))}
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={discardSuspects}
            disabled={busy || pendingSuspects.length === 0}
            title="Desconsidera todas as avaliações com nota máxima e comentário curto"
          >
            <EyeOff size={16} strokeWidth={1.8} />
            Desconsiderar suspeitas ({pendingSuspects.length})
          </button>
        </div>
      </fieldset>

      <div className="browser-controls peer-review-toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Buscar aluno…"
          aria-label="Buscar aluno"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {categories.length > 1 && (
          <label className="peer-review-field">
            Conjunto de grupos
            <select value={categoryId ?? ''} onChange={(e) => selectCategory(e.target.value)} disabled={loadingGroups}>
              {!categoryId && <option value="">Selecione…</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="peer-grader-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={copyAverages}
            disabled={busy || !hasRubric}
            title="Preenche as notas vazias com a média (menos a penalidade)"
          >
            <Copy size={16} strokeWidth={1.8} />
            <span className="rubric-grader-toolbar-btn-text">Copiar médias</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={clearGrades} disabled={busy} title="Limpar notas">
            <Eraser size={16} strokeWidth={1.8} />
            <span className="rubric-grader-toolbar-btn-text">Limpar notas</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={sendAll}
            disabled={busy || sendable.length === 0}
            title="Envia as notas alteradas ao Canvas"
          >
            {busy ? <LoaderCircle size={16} strokeWidth={1.8} className="sync-spin" /> : <Send size={16} strokeWidth={1.8} />}
            <span className="rubric-grader-toolbar-btn-text">
              {busy ? `Enviando… ${bulk.done}/${bulk.total}` : `Enviar ao Canvas (${sendable.length})`}
            </span>
          </button>
        </div>
      </div>

      <div className="segmented peer-grader-filters" role="group" aria-label="Filtrar por situação">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`segmented-btn${filter === key ? ' active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {groupsError && (
        <p className="alert alert-error" role="alert">
          {groupsError}
        </p>
      )}

      {failures.length > 0 && (
        <div className="alert alert-error" role="alert">
          {failures.length} nota(s) não foram enviadas:
          <ul>
            {failures.map(({ userId, error }) => (
              <li key={userId}>
                {studentById.get(userId)?.name}: {error}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => runBulk(failures.map((f) => f.userId))}
            disabled={busy}
          >
            <RotateCcw size={14} strokeWidth={1.8} />
            Tentar novamente
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="lede">Nenhum aluno para exibir com esse filtro.</p>
      ) : (
        <div className="rubric-grader-table-wrap">
          <table className="data-table rubric-grader-table peer-grader-table">
            <thead>
              <tr>
                <th>
                  <span className="sr-only">Situação</span>
                </th>
                <th aria-sort={sortAria('name')}>
                  <button type="button" className="th-sort-btn" onClick={() => toggleSort('name')}>
                    Aluno
                    <SortIcon direction={sort.key === 'name' ? sort.direction : null} />
                  </button>
                </th>
                <th aria-sort={sortAria('group')}>
                  <button type="button" className="th-sort-btn" onClick={() => toggleSort('group')}>
                    Grupo
                    <SortIcon direction={sort.key === 'group' ? sort.direction : null} />
                  </button>
                </th>
                <th>Notas recebidas</th>
                <th title="Revisões concluídas ÷ atribuídas (com comentário)">Revisões feitas</th>
                <th aria-sort={sortAria('average')}>
                  <button type="button" className="th-sort-btn" onClick={() => toggleSort('average')}>
                    Média
                    <SortIcon direction={sort.key === 'average' ? sort.direction : null} />
                  </button>
                </th>
                <th aria-sort={sortAria('stdDev')}>
                  <button
                    type="button"
                    className="th-sort-btn"
                    onClick={() => toggleSort('stdDev')}
                    title="Desvio padrão das notas recebidas (consideradas)"
                  >
                    Desvio
                    <SortIcon direction={sort.key === 'stdDev' ? sort.direction : null} />
                  </button>
                </th>
                <th>Penalidade</th>
                <th>{pointsPossible != null ? `Nota final (${formatPoints(pointsPossible)})` : 'Nota final'}</th>
                <th>Comentário</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const row = rows[s.userId];
                const state = sendState[s.userId] || {};
                const meta = STATUS_META[s.status];
                const StatusIconCmp = meta.Icon;
                const expanded = expandedIds.has(s.userId);
                const check = validateGrade(row.grade, pointsPossible);
                const { assigned, completed, completedWithComment, discarded: discardedGiven } = s.participation;
                const level = levelOf(s);
                return (
                  <Fragment key={s.userId}>
                    <tr className={row.dirty ? 'is-dirty' : undefined}>
                      <td className="status-cell">
                        <span
                          className="status-icon"
                          style={{ color: meta.color }}
                          title={meta.label}
                          role="img"
                          aria-label={meta.label}
                        >
                          <StatusIconCmp size={16} strokeWidth={1.8} />
                        </span>
                      </td>
                      <td className="course-name-cell">
                        <button
                          type="button"
                          className="rubric-grader-name-toggle"
                          onClick={() => toggleExpanded(s.userId)}
                          aria-expanded={expanded}
                          title="Ver avaliações e entrega"
                        >
                          <span className={`group-chevron${expanded ? ' expanded' : ''}`} aria-hidden="true">
                            <ChevronRight size={14} strokeWidth={2} />
                          </span>
                          {s.name}
                        </button>
                      </td>
                      <td>{s.groupName ?? '—'}</td>
                      <td>
                        {s.received.length === 0 ? (
                          <span className="peer-grader-muted">Sem avaliador</span>
                        ) : (
                          <ul className="peer-grader-scores">
                            {s.received.map((r) => {
                              const suspect = isSuspect(r);
                              return (
                                <li
                                  key={r.reviewerId}
                                  className={r.discarded ? 'is-discarded' : undefined}
                                  title={
                                    r.discarded
                                      ? `${r.reviewerName} — desconsiderada`
                                      : suspect
                                        ? `${r.reviewerName} — suspeita: nota máxima com comentário curto`
                                        : r.reviewerName
                                  }
                                >
                                  <strong>{r.score != null ? formatPoints(r.score) : r.completed ? '✓' : '—'}</strong>{' '}
                                  {r.reviewerName}
                                  {suspect && !r.discarded && (
                                    <TriangleAlert
                                      size={12}
                                      strokeWidth={2}
                                      className="peer-grader-suspect-icon"
                                      aria-label="Suspeita de avaliação descuidada"
                                    />
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                      <td className="pending-cell">
                        {assigned === 0 ? (
                          <span className="peer-grader-muted">—</span>
                        ) : (
                          <span title={`${completed} concluída(s), ${completedWithComment} com comentário`}>
                            {completed}/{assigned}
                            <span className="peer-grader-muted"> ({completedWithComment} c/ coment.)</span>
                            {discardedGiven > 0 && (
                              <span className="peer-grader-discarded-note" title="Avaliações deste aluno desconsideradas">
                                {' '}
                                {discardedGiven} desconsid.
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="rubric-grader-total">{formatPoints(s.average)}</td>
                      <td className="pending-cell">
                        {s.stdDev == null ? (
                          <span className="peer-grader-muted">—</span>
                        ) : (
                          <span
                            className={`peer-grader-sd is-${level}`}
                            title={
                              DISPERSION_META[level]
                                ? `${DISPERSION_META[level].label}: σ = ${formatPoints(s.stdDev)} pts`
                                : `σ = ${formatPoints(s.stdDev)} pts`
                            }
                          >
                            {formatPoints(s.stdDev)}
                          </span>
                        )}
                      </td>
                      <td className="peer-grader-penalty-cell">
                        <input
                          type="checkbox"
                          checked={row.penaltyOn}
                          onChange={(e) =>
                            patchRow(s.userId, {
                              penaltyOn: e.target.checked,
                              penalty: e.target.checked && row.penalty === '' ? penaltyConfig.points : row.penalty,
                            })
                          }
                          aria-label={`Penalizar ${s.name}`}
                        />
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={row.penalty}
                          disabled={!row.penaltyOn}
                          onChange={(e) => patchRow(s.userId, { penalty: e.target.value })}
                          aria-label={`Pontos de penalidade de ${s.name}`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={pointsPossible ?? undefined}
                          step="any"
                          className={`peer-grader-grade${check.valid ? '' : ' is-invalid'}`}
                          value={row.grade}
                          placeholder={s.status === 'unreviewed' ? 'Manual' : 'Nota'}
                          onChange={(e) => patchRow(s.userId, { grade: e.target.value, source: 'manual' })}
                          aria-label={`Nota final de ${s.name}`}
                          aria-invalid={!check.valid}
                          title={check.error}
                        />
                      </td>
                      <td className="rubric-grader-comment-cell">
                        <textarea
                          rows={2}
                          value={row.comment}
                          onChange={(e) => patchRow(s.userId, { comment: e.target.value })}
                          placeholder="Comentário para o aluno…"
                        />
                      </td>
                      <td className="actions-cell rubric-grader-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-icon"
                          disabled={busy || state.saving || check.empty || !check.valid}
                          onClick={() => sendOne(s.userId).catch(() => {})}
                          title={
                            check.empty
                              ? 'Lance uma nota para enviar'
                              : state.saving
                                ? 'Enviando…'
                                : state.saved
                                  ? 'Enviado ✓ (clique para reenviar)'
                                  : 'Enviar/atualizar nota e comentário no Canvas'
                          }
                          aria-label={`Enviar nota de ${s.name} ao Canvas`}
                        >
                          {state.saving ? (
                            <LoaderCircle size={14} strokeWidth={1.8} className="sync-spin" />
                          ) : state.saved && !row.dirty ? (
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
                        <td colSpan={COLUMN_COUNT}>
                          <PeerReviewDetail
                            student={s}
                            isSuspect={isSuspect}
                            onToggleDiscard={(key, on) => setDiscard([key], on)}
                            disabled={busy}
                          />
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

      <ul className="icon-legend">
        {Object.entries(STATUS_META).map(([key, { label, Icon, color }]) => (
          <li key={key}>
            <Icon size={14} strokeWidth={1.8} aria-hidden="true" style={{ color }} /> {label}
          </li>
        ))}
        <li>
          <TriangleAlert size={14} strokeWidth={1.8} aria-hidden="true" style={{ color: 'var(--warn)' }} /> Suspeita de
          avaliação descuidada
        </li>
        <li>
          <span className="peer-grader-legend-discarded">8</span> Avaliação desconsiderada
        </li>
        {Object.entries(DISPERSION_META).map(([key, { label }]) => (
          <li key={key}>
            <span className={`peer-grader-sd is-${key}`}>σ</span> {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewList({ reviews, nameKey, emptyText, isSuspect, onToggleDiscard, disabled }) {
  if (reviews.length === 0) return <p className="peer-grader-muted">{emptyText}</p>;
  return (
    <ul className="peer-grader-review-list">
      {reviews.map((r) => (
        <li key={r.key} className={r.discarded ? 'is-discarded' : undefined}>
          <div className="peer-grader-review-head">
            <strong>{r[nameKey]}</strong>
            <span className={`badge${r.completed ? '' : ' badge-muted'}`}>
              {r.score != null ? `${formatPoints(r.score)} pts` : r.completed ? 'Concluída' : 'Pendente'}
            </span>
            {r.discarded ? (
              <span className="badge badge-muted">Desconsiderada</span>
            ) : (
              isSuspect(r) && (
                <span className="peer-grader-suspect-badge">
                  <TriangleAlert size={12} strokeWidth={2} aria-hidden="true" />
                  Nota máxima com comentário curto
                </span>
              )
            )}
            {(r.completed || r.score != null) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm peer-grader-discard-btn"
                onClick={() => onToggleDiscard(r.key, !r.discarded)}
                disabled={disabled}
                title={
                  r.discarded
                    ? 'Voltar a considerar esta avaliação'
                    : 'Tirar esta nota da média do avaliado e contar a revisão como não feita para o avaliador'
                }
              >
                {r.discarded ? <Undo2 size={14} strokeWidth={1.8} /> : <EyeOff size={14} strokeWidth={1.8} />}
                {r.discarded ? 'Reconsiderar' : 'Desconsiderar'}
              </button>
            )}
          </div>
          {r.comments.length > 0 ? (
            <ul className="peer-grader-comments">
              {r.comments.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="peer-grader-muted">Sem comentários.</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function PeerReviewDetail({ student, isSuspect, onToggleDiscard, disabled }) {
  const listProps = { isSuspect, onToggleDiscard, disabled };
  return (
    <div className="message-detail peer-grader-detail">
      <div className="peer-grader-detail-grid">
        <section>
          <h3>Avaliações recebidas</h3>
          <ReviewList
            reviews={student.received}
            nameKey="reviewerName"
            emptyText="Nenhum avaliador atribuído."
            {...listProps}
          />
        </section>
        <section>
          <h3>Avaliações feitas pelo aluno</h3>
          <ReviewList
            reviews={student.given}
            nameKey="revieweeName"
            emptyText="Nenhuma revisão atribuída a este aluno."
            {...listProps}
          />
        </section>
      </div>
      {student.otherComments.length > 0 && (
        <section>
          <h3>Outros comentários na entrega</h3>
          <ul className="peer-grader-comments">
            {student.otherComments.map((c, i) => (
              <li key={i}>
                <strong>{c.authorName}:</strong> {c.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3>Entrega</h3>
        <SubmissionPreview studentName={student.name} {...student.preview} />
      </section>
    </div>
  );
}
