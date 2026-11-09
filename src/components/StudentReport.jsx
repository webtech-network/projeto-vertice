'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Mail, Gauge, Columns3, ChevronsDownUp, ChevronsUpDown, ChevronDown, ChevronRight, UserX, ShieldAlert } from 'lucide-react';
import { ENROLLMENT_STATE_LABELS, quartiles, quartileColor, robustScaleMax, scoreColor } from '@/lib/studentReport';
import { DEFAULT_WEIGHTS } from '@/lib/studentEngagement/scoring';
import { computeClassRiskResults } from '@/lib/studentEngagement/computeClassRisk';
import { saveEngagementSnapshots, listPreviousSnapshotsForCourse } from '@/lib/studentEngagement/studentEngagementRepo';
import StudentMessageModal from './StudentMessageModal';
import StudentEngagementDashboard from './StudentEngagementDashboard';
import SortIcon from './SortIcon';
import InfoHint from './InfoHint';
import RiskLevelPill from './RiskLevelPill';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function formatActivityTime(seconds) {
  if (seconds == null) return '—';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}min` : `${hours}h`;
}

function formatGrade(score, grade) {
  if (grade != null) return grade;
  if (score != null) return score;
  return '—';
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// Status da matrícula como label suave (mesmos tokens do RiskLevelPill):
// verde = ativa, vermelho = inativa/rejeitada, âmbar = demais estados.
const STATUS_PILL = { active: 'risk-pill-low', inactive: 'risk-pill-high', rejected: 'risk-pill-high' };

const RISK_LABEL = { low: 'Baixo', medium: 'Médio', high: 'Alto' };

const CSV_HEADERS = [
  'Nome',
  'E-mail/Login',
  'Status da matrícula',
  'Nível de Risco',
  'Índice',
  'Última atividade',
  'Tempo de atividade',
  'Nota atual',
  'Nota final',
];

// `groupColumns`: [{ header, groupsByStudent: Map<studentId, string[]> }] —
// uma coluna por conjunto de grupos do curso, logo após "E-mail/Login".
function rowsToCsv(rows, engagementResults, groupColumns) {
  const headers = [...CSV_HEADERS];
  headers.splice(2, 0, ...groupColumns.map((col) => col.header));
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    const risk = engagementResults.get(row.id);
    lines.push(
      [
        row.name,
        row.contact,
        ...groupColumns.map((col) => (col.groupsByStudent.get(row.id) || []).join('; ')),
        ENROLLMENT_STATE_LABELS[row.enrollmentState] || '—',
        risk?.riskLevel ? RISK_LABEL[risk.riskLevel] : '—',
        risk?.score != null ? Math.round(risk.score) : '—',
        formatDate(row.lastActivityAt),
        formatActivityTime(row.totalActivityTime),
        formatGrade(row.currentScore, row.currentGrade),
        formatGrade(row.finalScore, row.finalGrade),
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return lines.join('\n');
}

function buildGroupColumns(categories, groupsByCategory) {
  if (categories.length === 0) return [{ header: 'Grupo', groupsByStudent: new Map() }];
  return categories.map((category) => {
    const groupsByStudent = new Map();
    for (const group of groupsByCategory[category.id] || []) {
      for (const memberId of group.memberIds || []) {
        if (!groupsByStudent.has(memberId)) groupsByStudent.set(memberId, []);
        groupsByStudent.get(memberId).push(group.name);
      }
    }
    return {
      header: categories.length === 1 ? 'Grupo' : `Grupo (${category.name})`,
      groupsByStudent,
    };
  });
}

function downloadCsv(rows, engagementResults, groupColumns) {
  const csv = rowsToCsv(rows, engagementResults, groupColumns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alunos-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Notas do curso (grades) dependem de permissão da conta Canvas para o
// professor consultar — quando a conta não permite, `enrollment.grades`
// simplesmente não vem em nenhum aluno, então o relatório avisa em vez de
// mostrar duas colunas cheias de "—" sem explicação.
function allGradesMissing(rows) {
  return rows.every((r) => r.currentScore == null && r.currentGrade == null && r.finalScore == null && r.finalGrade == null);
}

// Same shape as CourseBrowser.jsx's own SORTERS/toggleSort/sortAria trio —
// a missing value sorts as the lowest possible one (-1 or '') so it lands
// first ascending / last descending. Grade columns sort by the numeric
// score only (currentGrade/finalGrade can be a non-numeric letter grade
// depending on the course's grading scheme, so score is the one reliably
// sortable field between the two formatGrade() already falls back through).
const SORTERS = {
  name: (r) => r.name?.toLowerCase() ?? '',
  contact: (r) => r.contact?.toLowerCase() ?? '',
  enrollmentState: (r) => ENROLLMENT_STATE_LABELS[r.enrollmentState]?.toLowerCase() ?? '',
  lastActivity: (r) => (r.lastActivityAt ? new Date(r.lastActivityAt).getTime() : -1),
  activityTime: (r) => r.totalActivityTime ?? -1,
  currentScore: (r) => r.currentScore ?? -1,
  finalScore: (r) => r.finalScore ?? -1,
};

export default function StudentReport({ rows, courseId, baseUrl, integrations = [] }) {
  const [query, setQuery] = useState('');
  const [messageStudent, setMessageStudent] = useState(null);
  const [sort, setSort] = useState({ key: null, direction: 'asc' });
  // Defaults to hiding inactive students — matches this page's own stated
  // scope ("Listagem dos alunos ativos do curso") — but stays a toggle
  // rather than a hard filter, since a professor might want to see who was
  // deactivated. See listCourseStudents() in canvasClient.js for why the
  // 'inactive' state is now fetched at all instead of being excluded
  // server-side.
  const [hideInactive, setHideInactive] = useState(true);
  // At most one student's engagement dashboard open at a time — same
  // reasoning as CourseBrowser.jsx's expandedCourseId: it's a heavier,
  // chart-rendering panel, not a cheap accordion, so stacking several at
  // once would both be visually noisy and needlessly re-fetch analytics for
  // students the professor isn't looking at right now.
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  // Colunas de análise (Nível de Risco, Última atividade, Tempo de atividade,
  // Nota atual, Nota final) — visíveis por padrão, ocultáveis em bloco.
  const [showAnalysis, setShowAnalysis] = useState(true);

  // Agrupamento por conjunto de grupos do Canvas. `categoryId` '' = sem
  // agrupamento. Os grupos (com ids dos membros) são buscados sob demanda ao
  // escolher o conjunto e cacheados por conjunto.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [groupsByCategory, setGroupsByCategory] = useState({});
  const [groupsState, setGroupsState] = useState({ loading: false, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/canvas/courses/${courseId}/group-categories`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && !data.error) setCategories(data.categories || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function handleSelectCategory(value) {
    setCategoryId(value);
    setCollapsed(new Set());
    setGroupsState({ loading: false, error: null });
    if (!value || groupsByCategory[value]) return;
    setGroupsState({ loading: true, error: null });
    try {
      const response = await fetch(`/api/canvas/courses/${courseId}/group-categories/${value}/groups`);
      const data = await response.json();
      if (data.error) {
        setGroupsState({ loading: false, error: data.error });
        return;
      }
      setGroupsByCategory((prev) => ({ ...prev, [value]: data.groups || [] }));
      setGroupsState({ loading: false, error: null });
    } catch {
      setGroupsState({ loading: false, error: 'Falha ao carregar os grupos do Canvas.' });
    }
  }

  // Exportação: carrega os membros de todos os conjuntos ainda não cacheados
  // (best-effort — conjunto que falhar sai com a coluna vazia) e gera o CSV
  // com uma coluna de grupo por conjunto.
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const missing = categories.filter((c) => !groupsByCategory[c.id]);
      const loaded = await Promise.all(
        missing.map(async (c) => {
          try {
            const response = await fetch(`/api/canvas/courses/${courseId}/group-categories/${c.id}/groups`);
            const data = await response.json();
            return data.error ? null : [c.id, data.groups || []];
          } catch {
            return null;
          }
        }),
      );
      const fetched = Object.fromEntries(loaded.filter(Boolean));
      const allGroups = { ...groupsByCategory, ...fetched };
      if (Object.keys(fetched).length) setGroupsByCategory((prev) => ({ ...prev, ...fetched }));
      downloadCsv(filtered, engagement.results, buildGroupColumns(categories, allGroups));
    } finally {
      setExporting(false);
    }
  }

  // Course-wide Analytics summaries (page views/participations/tardiness
  // per student) back both the donut chart and the "vs. média da turma"
  // bars in every student's dashboard, AND the "entrega"/"acesso"
  // dimensions of the Nível de Risco calculation below — one fetch, two
  // consumers. Lazily fetched the first time either trigger fires (a row
  // expands, or "Analisar situação dos alunos" runs) and shared from here.
  // `force` lets "Analisar situação dos alunos" re-fetch fresh data on
  // demand even if a row was already expanded earlier in the session;
  // passive row expansion never forces a refetch.
  const [summaries, setSummaries] = useState({ data: null, loading: false, error: null });
  const summariesStarted = useRef(false);

  async function loadSummaries({ force = false } = {}) {
    if (summariesStarted.current && !force) return summaries;
    summariesStarted.current = true;
    setSummaries((s) => ({ ...s, loading: true }));
    try {
      const response = await fetch(`/api/canvas/courses/${courseId}/analytics/students`);
      const data = await response.json();
      const next = data.error
        ? { data: null, loading: false, error: data.error }
        : { data: data.summaries || [], loading: false, error: null };
      setSummaries(next);
      return next;
    } catch {
      const next = { data: null, loading: false, error: 'Falha ao carregar os dados da situação dos alunos.' };
      setSummaries(next);
      return next;
    }
  }

  useEffect(() => {
    if (!expandedStudentId) return;
    loadSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedStudentId]);

  // Nível de Risco — composite index (desempenho/entrega/acesso) + risk
  // level relative to this analysis's own class quartiles (see
  // src/lib/studentEngagement/scoring.js). Sob demanda: nothing here runs
  // until "Analisar situação dos alunos" is clicked.
  const [engagement, setEngagement] = useState({ status: 'idle', results: new Map(), quartiles: null, error: null });

  async function handleAnalyzeEngagement() {
    setEngagement((s) => ({ ...s, status: 'loading', error: null }));

    const summariesResult = await loadSummaries({ force: true });

    let previousScores = new Map();
    try {
      previousScores = await listPreviousSnapshotsForCourse(courseId);
    } catch {
      // best-effort — a seta de tendência simplesmente não aparece
    }

    const { results, quartiles: riskQuartiles } = computeClassRiskResults(rows, summariesResult.data);

    const snapshotsToSave = [];
    for (const [studentId, result] of results) {
      result.previousScore = previousScores.get(studentId) ?? null;
      if (result.riskLevel) {
        snapshotsToSave.push({
          studentId,
          score: result.score,
          riskLevel: result.riskLevel,
          coverage: result.coverage,
          dimensions: result.dimensions,
          weightsUsed: DEFAULT_WEIGHTS,
          quartiles: riskQuartiles,
        });
      }
    }

    // Best-effort: se o histórico falhar em salvar, o professor ainda vê o
    // resultado desta rodada na tabela — só o histórico fica sem esse ponto.
    saveEngagementSnapshots(courseId, snapshotsToSave).catch(() => {});

    setEngagement({ status: 'loaded', results, quartiles: riskQuartiles, error: summariesResult.error });
  }

  // Max + quartiles over every active-or-not row passed in (not
  // `filtered`/`sorted` below) so the "Tempo de atividade" bar's scale and
  // quartile markers stay stable regardless of the search/inactive-filter.
  // Quartiles (not a plain average) drive both the marker positions and the
  // fill color below — see quartileColor's own comment for why. The `max`
  // here is the *robust* scale (Tukey fence), not the raw maximum, so a
  // single student with an absurd total activity time can't flatten every
  // other bar and the markers to ~0 — see robustScaleMax in studentReport.js.
  const timeStats = useMemo(() => {
    const times = rows.map((r) => r.totalActivityTime).filter((t) => t != null);
    return { max: robustScaleMax(times), ...quartiles(times) };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (hideInactive && row.enrollmentState === 'inactive') return false;
      if (!term) return true;
      return row.name?.toLowerCase().includes(term) || row.contact?.toLowerCase().includes(term);
    });
  }, [rows, query, hideInactive]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const getValue = sort.key === 'riskScore' ? (r) => engagement.results.get(r.id)?.score ?? -1 : SORTERS[sort.key];
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });
  }, [filtered, sort, engagement.results]);

  // Seções da tabela: uma por grupo do conjunto escolhido (na ordem do
  // Canvas), mais "Sem grupo". Aluno em mais de um grupo do mesmo conjunto
  // (não ocorre no Canvas) apareceria só no primeiro.
  const sections = useMemo(() => {
    const groups = categoryId ? groupsByCategory[categoryId] : null;
    if (!groups) return [{ key: 'all', title: null, rows: sorted }];
    const placed = new Set();
    const result = [];
    for (const group of groups) {
      const members = new Set(group.memberIds);
      const groupRows = sorted.filter((r) => members.has(r.id) && !placed.has(r.id));
      groupRows.forEach((r) => placed.add(r.id));
      if (groupRows.length) result.push({ key: `g${group.id}`, title: group.name, rows: groupRows });
    }
    const rest = sorted.filter((r) => !placed.has(r.id));
    if (rest.length) result.push({ key: 'none', title: 'Sem grupo', rows: rest });
    return result;
  }, [sorted, categoryId, groupsByCategory]);

  const grouped = sections.some((sec) => sec.title);
  const groupKeys = sections.filter((sec) => sec.title).map((sec) => sec.key);
  const allCollapsed = grouped && groupKeys.every((k) => collapsed.has(k));

  function toggleAllGroups() {
    setCollapsed(allCollapsed ? new Set() : new Set(groupKeys));
  }

  function toggleGroup(key) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const columnCount = showAnalysis ? 9 : 4;

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

  const gradesUnavailable = useMemo(() => allGradesMissing(rows), [rows]);

  if (rows.length === 0) {
    return <p className="lede">Nenhum aluno ativo encontrado neste curso.</p>;
  }

  return (
    <>
      <div className="page-title-row">
        <h2>Alunos</h2>
        <InfoHint label="Como usar esta tela e como o Nível de Risco é calculado">
          <p>
            Os botões acima da tabela, em ordem: <strong>colapsar/expandir grupos</strong> (ativo ao agrupar por um
            conjunto de grupos do curso; também dá para recolher cada grupo pelo cabeçalho),{' '}
            <strong>ocultar alunos inativos</strong>, <strong>exibir colunas de análise</strong> (Nível de Risco,
            última atividade, tempo de atividade e notas), <strong>analisar risco de evasão</strong> e{' '}
            <strong>exportar dados (CSV)</strong>. Os botões de liga/desliga ficam preenchidos quando ativos.
          </p>
          <p>
            O índice combina três dimensões, com peso igual entre elas (fixo por ora, sem tela de configuração):{' '}
            <strong>desempenho</strong> (nota atual), <strong>entrega</strong> (proporção de atividades no prazo,
            atrasadas ou faltando) e <strong>acesso</strong> (frequência de uso do curso). Uma dimensão sem dado
            disponível (ex.: conta Canvas sem notas expostas) simplesmente não entra na conta — as outras absorvem o
            peso dela.
          </p>
          <p>
            As faixas <strong>Baixo</strong>/<strong>Médio</strong>/<strong>Alto</strong> não são cortes fixos: a cada
            análise, calcula-se o índice de todos os alunos ativos e divide-se essa distribuição em quartis. Quem
            fica no quartil inferior (25% com pior índice) é <strong>Alto</strong> risco; quem fica no quartil
            superior (25% com melhor índice) é <strong>Baixo</strong>; o meio da turma é <strong>Médio</strong>. Por
            isso o rótulo de um aluno pode mudar entre duas análises mesmo sem o índice dele mudar muito — ele é
            relativo à turma naquele momento, não uma escala universal.
          </p>
          <p>O resultado de cada análise é salvo (no máximo uma vez por dia por aluno) para consulta histórica.</p>
        </InfoHint>
      </div>

      <div className="browser-controls">
        <input
          type="search"
          className="search-input"
          placeholder="Pesquisar por nome ou e-mail..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Pesquisar alunos"
        />
        {categories.length > 0 && (
          <select
            className="group-select"
            aria-label="Agrupar por"
            value={categoryId}
            onChange={(e) => handleSelectCategory(e.target.value)}
            disabled={groupsState.loading}
          >
            <option value="">Agrupar por…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <div className="browser-controls-actions student-toolbar">
          <button
            type="button"
            className="btn btn-primary btn-icon"
            title={allCollapsed ? 'Expandir todos os grupos' : 'Colapsar todos os grupos'}
            aria-label={allCollapsed ? 'Expandir todos os grupos' : 'Colapsar todos os grupos'}
            disabled={!grouped}
            onClick={toggleAllGroups}
          >
            {allCollapsed ? <ChevronsUpDown size={18} strokeWidth={1.8} /> : <ChevronsDownUp size={18} strokeWidth={1.8} />}
          </button>
          <button
            type="button"
            className={`btn btn-icon ${hideInactive ? 'btn-primary' : 'btn-secondary'}`}
            title="Ocultar alunos inativos"
            aria-label="Ocultar alunos inativos"
            aria-pressed={hideInactive}
            onClick={() => setHideInactive((v) => !v)}
          >
            <UserX size={18} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className={`btn btn-icon ${showAnalysis ? 'btn-primary' : 'btn-secondary'}`}
            title="Exibir colunas de análise"
            aria-label="Exibir colunas de análise"
            aria-pressed={showAnalysis}
            onClick={() => setShowAnalysis((v) => !v)}
          >
            <Columns3 size={18} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="btn btn-primary btn-icon"
            title={engagement.status === 'loading' ? 'Analisando…' : 'Analisar risco de evasão'}
            aria-label="Analisar risco de evasão"
            disabled={engagement.status === 'loading'}
            onClick={handleAnalyzeEngagement}
          >
            <ShieldAlert size={18} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="btn btn-primary btn-icon"
            title={exporting ? 'Exportando…' : 'Exportar Dados (CSV)'}
            aria-label="Exportar Dados (CSV)"
            disabled={exporting}
            onClick={handleExport}
          >
            <Download size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {gradesUnavailable && (
        <p className="alert alert-warning" role="alert">
          As notas não estão disponíveis para consulta via API nesta conta Canvas — as colunas de nota ficarão em
          branco para todos os alunos.
        </p>
      )}

      {groupsState.error && (
        <p className="alert alert-warning" role="alert">
          {groupsState.error}
        </p>
      )}

      {engagement.status === 'loaded' && engagement.error && (
        <p className="alert alert-warning" role="alert">
          {engagement.error} O Nível de Risco foi calculado só com os sinais disponíveis (desempenho e acesso), sem o
          detalhamento de entregas no prazo.
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="lede">
          {hideInactive && query.trim() === ''
            ? 'Nenhum aluno ativo encontrado — desative o botão "Ocultar alunos inativos" para ver todos.'
            : 'Nenhum aluno encontrado com essa pesquisa.'}
        </p>
      ) : (
        <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th aria-sort={sortAria('name')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('name')}>
                  Nome
                  <SortIcon direction={sort.key === 'name' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('contact')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('contact')}>
                  E-mail/Login
                  <SortIcon direction={sort.key === 'contact' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('enrollmentState')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('enrollmentState')}>
                  Status
                  <SortIcon direction={sort.key === 'enrollmentState' ? sort.direction : null} />
                </button>
              </th>
              {showAnalysis && (
                <>
              <th aria-sort={sortAria('riskScore')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('riskScore')}>
                  Nível de Risco
                  <SortIcon direction={sort.key === 'riskScore' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('lastActivity')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('lastActivity')}>
                  Última atividade
                  <SortIcon direction={sort.key === 'lastActivity' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('activityTime')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('activityTime')}>
                  Tempo de atividade
                  <SortIcon direction={sort.key === 'activityTime' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('currentScore')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('currentScore')}>
                  Nota atual
                  <SortIcon direction={sort.key === 'currentScore' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('finalScore')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('finalScore')}>
                  Nota final
                  <SortIcon direction={sort.key === 'finalScore' ? sort.direction : null} />
                </button>
              </th>
                </>
              )}
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <Fragment key={section.key}>
                {section.title && (
                  <tr className="group-header-row">
                    <th colSpan={columnCount} scope="colgroup">
                      <button
                        type="button"
                        className="group-toggle-btn"
                        aria-expanded={!collapsed.has(section.key)}
                        onClick={() => toggleGroup(section.key)}
                      >
                        {collapsed.has(section.key) ? <ChevronRight size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
                        {section.title} <span className="muted">({section.rows.length})</span>
                      </button>
                    </th>
                  </tr>
                )}
                {(collapsed.has(section.key) ? [] : section.rows).map((row) => {
              const expanded = expandedStudentId === row.id;
              const riskResult = engagement.results.get(row.id);
              return (
                <Fragment key={row.id}>
                  <tr className={expanded ? 'is-expanded' : undefined}>
                    <td className={`course-name-cell${section.title ? ' student-name--grouped' : ''}`}>{row.name}</td>
                    <td title={row.contactIsLogin ? 'E-mail não disponível — exibindo login do Canvas' : undefined}>
                      {row.contact}
                    </td>
                    <td>
                      {ENROLLMENT_STATE_LABELS[row.enrollmentState] ? (
                        <span className={`risk-pill ${STATUS_PILL[row.enrollmentState] || 'risk-pill-medium'}`}>
                          {ENROLLMENT_STATE_LABELS[row.enrollmentState]}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    {showAnalysis && (
                      <>
                    <td>
                      <RiskLevelPill level={riskResult?.riskLevel} score={riskResult?.score} previousScore={riskResult?.previousScore} />
                    </td>
                    <td>{formatDate(row.lastActivityAt)}</td>
                    <td className="student-metric-cell">
                      <span className="student-metric-value">{formatActivityTime(row.totalActivityTime)}</span>
                      {timeStats.max > 0 && row.totalActivityTime != null && (
                        <div className="engagement-bar-track student-metric-bar">
                          <div
                            className="engagement-bar-fill"
                            style={{
                              width: `${Math.min(100, (row.totalActivityTime / timeStats.max) * 100)}%`,
                              background: quartileColor(row.totalActivityTime, timeStats),
                            }}
                          />
                          <div
                            className="engagement-bar-quartile-marker"
                            style={{ left: `${Math.min(100, (timeStats.q1 / timeStats.max) * 100)}%` }}
                            title={`1º quartil da turma: ${formatActivityTime(timeStats.q1)}`}
                          />
                          <div
                            className="engagement-bar-quartile-marker engagement-bar-quartile-marker--median"
                            style={{ left: `${Math.min(100, (timeStats.q2 / timeStats.max) * 100)}%` }}
                            title={`Mediana da turma: ${formatActivityTime(timeStats.q2)}`}
                          />
                          <div
                            className="engagement-bar-quartile-marker"
                            style={{ left: `${Math.min(100, (timeStats.q3 / timeStats.max) * 100)}%` }}
                            title={`3º quartil da turma: ${formatActivityTime(timeStats.q3)}`}
                          />
                        </div>
                      )}
                    </td>
                    <td className="student-metric-cell">
                      <span className="student-metric-value">{formatGrade(row.currentScore, row.currentGrade)}</span>
                      {row.currentScore != null && (
                        <div className="engagement-bar-track student-metric-bar">
                          <div
                            className="engagement-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, row.currentScore))}%`,
                              background: scoreColor(row.currentScore),
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td>{formatGrade(row.finalScore, row.finalGrade)}</td>
                      </>
                    )}
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-primary btn-icon"
                        title="Enviar mensagem com IA"
                        aria-label={`Enviar mensagem com IA para ${row.name}`}
                        onClick={() => setMessageStudent(row)}
                      >
                        <Mail size={18} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-icon"
                        title="Situação do aluno"
                        aria-label={`Ver situação do aluno ${row.name}`}
                        aria-expanded={expanded}
                        onClick={() => setExpandedStudentId(expanded ? null : row.id)}
                      >
                        <Gauge size={18} strokeWidth={1.8} />
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="course-note-row">
                      <td colSpan={columnCount}>
                        <StudentEngagementDashboard
                          courseId={courseId}
                          baseUrl={baseUrl}
                          student={row}
                          allRows={rows}
                          summaries={summaries.data}
                          summariesLoading={summaries.loading}
                          summariesError={summaries.error}
                          riskResult={riskResult}
                          riskQuartiles={engagement.quartiles}
                        />
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
      )}

      {messageStudent && (
        <StudentMessageModal
          student={messageStudent}
          courseId={courseId}
          integrations={integrations}
          onClose={() => setMessageStudent(null)}
        />
      )}
    </>
  );
}
