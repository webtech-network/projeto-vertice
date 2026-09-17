'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Mail, Gauge } from 'lucide-react';
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

function rowsToCsv(rows, engagementResults) {
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    const risk = engagementResults.get(row.id);
    lines.push(
      [
        row.name,
        row.contact,
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

function downloadCsv(rows, engagementResults) {
  const csv = rowsToCsv(rows, engagementResults);
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
        <InfoHint label="Como o Nível de Risco é calculado">
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
        <label className="checkbox-filter">
          <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} />
          Ocultar alunos inativos
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => downloadCsv(filtered, engagement.results)}>
          <Download size={16} strokeWidth={1.8} aria-hidden="true" />
          Exportar CSV
        </button>
        <button type="button" className="btn btn-primary" disabled={engagement.status === 'loading'} onClick={handleAnalyzeEngagement}>
          {engagement.status === 'loading' ? 'Analisando…' : engagement.status === 'loaded' ? 'Reanalisar situação dos alunos' : 'Analisar situação dos alunos'}
        </button>
      </div>

      {gradesUnavailable && (
        <p className="alert alert-warning" role="alert">
          As notas não estão disponíveis para consulta via API nesta conta Canvas — as colunas de nota ficarão em
          branco para todos os alunos.
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
            ? 'Nenhum aluno ativo encontrado — desmarque "Ocultar alunos inativos" para ver todos.'
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
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const expanded = expandedStudentId === row.id;
              const riskResult = engagement.results.get(row.id);
              return (
                <Fragment key={row.id}>
                  <tr className={expanded ? 'is-expanded' : undefined}>
                    <td className="course-name-cell">{row.name}</td>
                    <td title={row.contactIsLogin ? 'E-mail não disponível — exibindo login do Canvas' : undefined}>
                      {row.contact}
                    </td>
                    <td>{ENROLLMENT_STATE_LABELS[row.enrollmentState] || '—'}</td>
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
                      <td colSpan={9}>
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
