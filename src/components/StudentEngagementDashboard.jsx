'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { studentGradesUrl } from '@/lib/canvasLinks';
import { mean, quartiles, robustScaleMax, scoreColor } from '@/lib/studentReport';
import { describeRiskPosition } from '@/lib/studentEngagement/scoring';
import { computeClassRiskResults } from '@/lib/studentEngagement/computeClassRisk';
import { getCustomPrompt } from '@/lib/customPrompts';
import RiskLevelPill from './RiskLevelPill';
import EngagementHistoryChart from './EngagementHistoryChart';
import Modal from './Modal';

const DAY_MS = 24 * 60 * 60 * 1000;

// Delivery-status vocabulary Canvas's Analytics API uses for both the
// course-wide tardiness_breakdown (donut) and the per-assignment list below
// — one place so both stay in sync. Colors reuse this app's existing
// status tokens (--ok/--warn/--err, already the meaning "good/attention/
// critical" everywhere else — alerts, pending badges, urgent flags) rather
// than inventing a new palette; 'floating' (no due date, Canvas's own 4th
// bucket) gets a neutral ink-soft since it isn't a good/bad state.
const STATUS_META = {
  on_time: { label: 'Em dia', color: 'var(--ok)' },
  late: { label: 'Atrasada', color: 'var(--warn)' },
  missing: { label: 'Não entregue', color: 'var(--err)' },
  floating: { label: 'Sem prazo', color: 'var(--ink-soft)' },
};

function formatActivityTime(seconds) {
  if (seconds == null) return '—';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}min` : `${hours}h`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return '—';
  }
}

// (1 - "days since last access"/30), clamped — 1 = accessed today, 0 = 30+
// days ago (or never). The "último acesso" gauge's continuous
// green->yellow->red spectrum is driven directly by this same fraction, so
// the needle's position and the color underneath it always agree.
function lastAccessFraction(lastActivityAt) {
  if (!lastActivityAt) return 0;
  const daysSince = Math.max(0, (Date.now() - new Date(lastActivityAt).getTime()) / DAY_MS);
  return Math.max(0, Math.min(1, (30 - daysSince) / 30));
}

function formatDaysAgoLabel(daysSince) {
  if (daysSince <= 0) return 'Hoje';
  if (daysSince === 1) return 'há 1 dia';
  return `há ${daysSince} dias`;
}

function formatLastAccessLabel(lastActivityAt) {
  if (!lastActivityAt) return 'Nunca acessou';
  const daysSince = Math.floor(Math.max(0, (Date.now() - new Date(lastActivityAt).getTime()) / DAY_MS));
  return formatDaysAgoLabel(daysSince);
}

// Continuous traffic-light hue (0=red -> 120=green) — deliberately not a
// snap-to-one-of-3-tokens threshold like scoreColor: the request was a
// color that "varia no espectro", so hue is interpolated directly from the
// 0-1 fraction instead of bucketing it first.
function spectrumColor(fraction) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return `hsl(${Math.round(clamped * 120)}, 68%, 42%)`;
}

// angle 0 = straight up, -90 = left, 90 = right — see describeArc below.
function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

// A left-to-right arc bulging upward (the classic speedometer dome) — used
// both for the track (-90 to 90, a full semicircle) and the value fill
// (-90 to -90 + 180*fraction).
function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

// Semicircle gauge — value/label sit below the arc rather than overlapping
// it, deliberately: simpler and more robust across different label lengths
// than absolutely-centering text inside the dome.
//
// `averageFraction` (0-1), when given, draws a short radial tick across the
// track at the class average's position — every gauge in this dashboard
// gets one, so "am I above or below the class?" reads at a glance without
// needing the exact number.
//
// `spectrum` swaps the flat single-color progress arc for a continuous
// green->yellow->red track (many small colored segments — this app has no
// charting library, so no true gradient-along-a-path) plus a needle marking
// the value's position, instead of filling the track up to the value —
// the whole track already carries the color meaning, so a second fill would
// just duplicate it.
function Gauge({ label, valueLabel, fraction, color, sublabel, averageFraction, averageLabel, spectrum }) {
  const w = 140;
  const h = 80;
  const cx = w / 2;
  const cy = 72;
  const r = 54;
  const strokeWidth = 10;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));

  const track = spectrum ? (
    Array.from({ length: 36 }, (_, i) => {
      const segStart = -90 + (180 * i) / 36;
      const segEnd = -90 + (180 * (i + 1)) / 36;
      const midFraction = (i + 0.5) / 36;
      return (
        <path
          key={i}
          d={describeArc(cx, cy, r, segStart, segEnd)}
          fill="none"
          stroke={spectrumColor(midFraction)}
          strokeWidth={strokeWidth}
        />
      );
    })
  ) : (
    <path d={describeArc(cx, cy, r, -90, 90)} fill="none" stroke="var(--line)" strokeWidth={strokeWidth} strokeLinecap="round" />
  );

  const valuePath = !spectrum && clamped > 0 ? describeArc(cx, cy, r, -90, -90 + 180 * clamped) : null;

  const needleAngle = -90 + 180 * clamped;
  const needleInner = polarToCartesian(cx, cy, r - strokeWidth / 2 - 2, needleAngle);
  const needleOuter = polarToCartesian(cx, cy, r + strokeWidth / 2 + 2, needleAngle);

  let avgMarker = null;
  if (averageFraction != null) {
    const angle = -90 + 180 * Math.max(0, Math.min(1, averageFraction));
    const inner = polarToCartesian(cx, cy, r - strokeWidth / 2 - 4, angle);
    const outer = polarToCartesian(cx, cy, r + strokeWidth / 2 + 4, angle);
    avgMarker = (
      <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round" opacity={0.6}>
        <title>{averageLabel || 'Média da turma'}</title>
      </line>
    );
  }

  return (
    <div className="engagement-gauge">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`${label}: ${valueLabel}`}>
        {track}
        {valuePath && <path d={valuePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />}
        {spectrum && (
          <line
            x1={needleInner.x}
            y1={needleInner.y}
            x2={needleOuter.x}
            y2={needleOuter.y}
            stroke="var(--ink)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}
        {avgMarker}
      </svg>
      <div className="engagement-gauge-value" style={{ color }}>
        {valueLabel}
      </div>
      <div className="engagement-gauge-label">{label}</div>
      {sublabel && <div className="engagement-gauge-sublabel">{sublabel}</div>}
    </div>
  );
}

// Composition donut (tardiness breakdown) — a stacked-circle technique
// (stroke-dasharray per segment, rotated into place) since this app has no
// charting library. A 2px gap between segments (subtracted from each dash)
// keeps adjacent same-ish colors visually separated.
function Donut({ segments, centerValue, centerLabel }) {
  const size = 116;
  const strokeWidth = 18;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let accum = 0;

  return (
    <div className="engagement-donut">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Atividades entregues">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={strokeWidth} />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => {
              const fraction = s.value / total;
              const dash = Math.max(0, fraction * circumference - 2);
              const rotation = (accum / total) * 360 - 90;
              accum += s.value;
              return (
                <circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
                >
                  <title>{`${s.label}: ${s.value}`}</title>
                </circle>
              );
            })}
      </svg>
      <div className="engagement-donut-center">
        <div className="engagement-donut-center-value">{centerValue}</div>
        <div className="engagement-donut-center-label">{centerLabel}</div>
      </div>
    </div>
  );
}

// One row of a simple bar-vs-class-average comparison — plain HTML/CSS bars
// (no SVG needed for a single straight fill), with a thin marker at the
// class average position rather than a second bar, so both numbers share
// one axis instead of the dual-bar-per-row clutter that'd come from drawing
// the average as its own full bar.
function CompareBar({ label, value, average, max }) {
  const denom = max > 0 ? max : 1;
  const valuePct = Math.min(100, (value / denom) * 100);
  const avgPct = Math.min(100, (average / denom) * 100);
  return (
    <div className="engagement-bar-row">
      <div className="engagement-bar-row-head">
        <span>{label}</span>
        <span className="engagement-bar-row-value">{value}</span>
      </div>
      <div className="engagement-bar-track">
        <div className="engagement-bar-fill" style={{ width: `${valuePct}%` }} />
        <div className="engagement-bar-avg-marker" style={{ left: `${avgPct}%` }} title={`Média da turma: ${Math.round(average)}`} />
      </div>
    </div>
  );
}

/**
 * Replaces the old "Ver notas no Canvas" external link (StudentReport.jsx) —
 * an inline, visual read on one student's situation in the course ("Situação
 * do Aluno(a)") instead of sending the professor away to Canvas's own
 * gradebook. Two data sources:
 *
 * - `student`/`allRows` (already in memory — buildStudentRows' output,
 *   nothing to fetch): backs the tempo-de-acesso, nota atual and último
 *   acesso gauges, so those render instantly with no loading state.
 * - Canvas's classic Analytics API, `summaries` (the whole course's
 *   page-views/participations/tardiness-breakdown, fetched once by
 *   StudentReport.jsx and shared across whichever student's row is expanded
 *   — see its own comment) backs the atividades-entregues gauge, the donut
 *   and the engagement-vs-average bars; this student's own per-assignment
 *   breakdown (fetched here, lazily, since it's genuinely per-student) backs
 *   the detail list. Not every Canvas account has Analytics enabled, so both
 *   can come back as an error — degrades to just the always-available gauges
 *   instead of hiding the whole dashboard.
 */
export default function StudentEngagementDashboard({
  courseId,
  baseUrl,
  student,
  allRows,
  summaries,
  summariesLoading,
  summariesError,
  riskResult,
  riskQuartiles,
}) {
  const [assignments, setAssignments] = useState({ data: null, loading: true, error: null });
  const [analysis, setAnalysis] = useState({ open: false, loading: false, text: null, error: null, notConfigured: false });

  // Risco do aluno calculado aqui, na abertura do painel, em vez de depender
  // de StudentReport ter rodado "Analisar situação dos alunos": a análise por
  // IA fica disponível assim que a "Situação do Aluno(a)" abre. Se a análise
  // em nível de turma já rodou, o resultado dela (que tem previousScore, para
  // a seta de tendência) tem preferência sobre este cálculo local.
  const fallbackRisk = useMemo(() => {
    const { results, quartiles } = computeClassRiskResults(allRows, summaries);
    return { result: results.get(student.id), quartiles };
  }, [allRows, summaries, student.id]);
  const effectiveRiskResult = riskResult ?? fallbackRisk.result;
  const effectiveQuartiles = riskQuartiles ?? fallbackRisk.quartiles;

  async function handleAnalyzeWithAI() {
    if (!effectiveRiskResult?.riskLevel) {
      setAnalysis({
        open: true,
        loading: false,
        text: null,
        error: 'Não há dados suficientes (nota, entregas ou acesso) para analisar a situação deste aluno.',
        notConfigured: false,
      });
      return;
    }
    setAnalysis({ open: true, loading: true, text: null, error: null, notConfigured: false });
    try {
      let customPromptText = null;
      let customPromptMode = null;
      try {
        const custom = await getCustomPrompt('analyzeStudent');
        customPromptText = custom?.text ?? null;
        customPromptMode = custom?.mode ?? null;
      } catch {
        // O prompt customizado é opcional — se a leitura falhar, segue com o padrão.
      }

      // Envia só riskResult/riskQuartiles (já anônimos — sem nome/e-mail/id);
      // a rota monta o payload definitivo via buildStudentAnalysisPayload.
      const res = await fetch('/api/ai/analyze-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riskResult: effectiveRiskResult, riskQuartiles: effectiveQuartiles, customPromptText, customPromptMode }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setAnalysis({
          open: true,
          loading: false,
          text: null,
          error: data?.error || 'Falha ao analisar a situação do aluno.',
          notConfigured: res.status === 404,
        });
        return;
      }
      setAnalysis({ open: true, loading: false, text: data?.analysis || null, error: null, notConfigured: false });
    } catch {
      setAnalysis({ open: true, loading: false, text: null, error: 'Falha ao analisar a situação do aluno.', notConfigured: false });
    }
  }

  useEffect(() => {
    let cancelled = false;
    setAssignments({ data: null, loading: true, error: null });
    fetch(`/api/canvas/courses/${courseId}/students/${student.id}/assignment-analytics`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setAssignments({ data: null, loading: false, error: data.error });
        else setAssignments({ data: data.assignments || [], loading: false, error: null });
      })
      .catch(() => {
        if (!cancelled) setAssignments({ data: null, loading: false, error: 'Falha ao carregar as atividades deste aluno.' });
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, student.id]);

  const times = allRows.map((r) => r.totalActivityTime).filter((t) => t != null);
  // Robust scale (Tukey fence) + median, not raw max + mean: one student with
  // an outlier total_activity_time would otherwise flatten the needle to ~0
  // and drag the "da turma" marker to a value nobody else is near.
  const maxTime = robustScaleMax(times);
  const medianTime = quartiles(times).q2;

  const currentScores = allRows.map((r) => r.currentScore).filter((v) => v != null);
  const avgCurrentScore = currentScores.length ? mean(currentScores) : null;

  const lastAccessOwnFraction = lastAccessFraction(student.lastActivityAt);
  const avgLastAccessFraction = mean(allRows.map((r) => lastAccessFraction(r.lastActivityAt)));

  const mySummary = summaries?.find((s) => String(s.id) === String(student.id)) || null;
  const tardiness = mySummary?.tardiness_breakdown || { on_time: 0, late: 0, missing: 0, floating: 0 };
  const donutSegments = ['on_time', 'late', 'missing', 'floating'].map((key) => ({
    key,
    value: tardiness[key] || 0,
    label: STATUS_META[key].label,
    color: STATUS_META[key].color,
  }));
  // "Vencidas" = on_time + late + missing (assignments with a due date that
  // has already passed — 'floating' has no due date at all, so it can't be
  // "vencida"); "entregues" = on_time + late (anything actually submitted,
  // whether on time or not).
  const dueCount = (tardiness.on_time || 0) + (tardiness.late || 0) + (tardiness.missing || 0);
  const delivered = (tardiness.on_time || 0) + (tardiness.late || 0);
  const deliveryFraction = dueCount > 0 ? delivered / dueCount : 0;

  const deliveryRates = (summaries || [])
    .map((s) => {
      const t = s.tardiness_breakdown || {};
      const due = (t.on_time || 0) + (t.late || 0) + (t.missing || 0);
      return due > 0 ? ((t.on_time || 0) + (t.late || 0)) / due : null;
    })
    .filter((v) => v != null);
  const avgDeliveryFraction = deliveryRates.length ? mean(deliveryRates) : null;

  const pageViewsMax = Math.max(1, ...(summaries || []).map((s) => s.page_views || 0));
  const participationsMax = Math.max(1, ...(summaries || []).map((s) => s.participations || 0));
  const avgPageViews = mean((summaries || []).map((s) => s.page_views || 0));
  const avgParticipations = mean((summaries || []).map((s) => s.participations || 0));

  return (
    <div className="engagement-dashboard">
      <div className="engagement-dashboard-head">
        <h4 className="engagement-dashboard-title">
          Situação do Aluno(a)
          {baseUrl && (
            <a
              href={studentGradesUrl(baseUrl, courseId, student.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="external-link-icon"
              title="Ver notas no Canvas"
              aria-label={`Ver notas de ${student.name} no Canvas`}
            >
              <ExternalLink size={14} strokeWidth={1.8} />
            </a>
          )}
        </h4>
        <button type="button" className="btn btn-secondary" onClick={handleAnalyzeWithAI} disabled={analysis.loading}>
          {analysis.loading ? 'Analisando…' : 'Analisar com IA'}
        </button>
      </div>

      {effectiveRiskResult?.riskLevel && (
        <div className="risk-summary">
          <div className="risk-summary-head">
            <RiskLevelPill level={effectiveRiskResult.riskLevel} score={effectiveRiskResult.score} previousScore={effectiveRiskResult.previousScore} />
            <p className="risk-summary-text">{describeRiskPosition(effectiveRiskResult, effectiveQuartiles)}</p>
          </div>
          {Object.values(effectiveRiskResult.dimensions)
            .flatMap((d) => d.reasons)
            .filter(Boolean).length > 0 && (
            <ul className="risk-summary-reasons">
              {Object.values(effectiveRiskResult.dimensions)
                .flatMap((d) => d.reasons)
                .filter(Boolean)
                .map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
            </ul>
          )}
        </div>
      )}

      <div className="engagement-gauges-row">
        <Gauge
          label="Tempo de acesso"
          valueLabel={formatActivityTime(student.totalActivityTime)}
          fraction={maxTime > 0 ? student.totalActivityTime / maxTime : 0}
          color="var(--brand)"
          sublabel="Tempo total registrado no curso"
          averageFraction={maxTime > 0 ? medianTime / maxTime : undefined}
          averageLabel={`Mediana da turma: ${formatActivityTime(medianTime)}`}
        />
        <Gauge
          label="Nota atual"
          valueLabel={student.currentScore != null ? `${Math.round(student.currentScore)}%` : '—'}
          fraction={student.currentScore != null ? student.currentScore / 100 : 0}
          color={scoreColor(student.currentScore)}
          sublabel="Com base no total já distribuído"
          averageFraction={avgCurrentScore != null ? avgCurrentScore / 100 : undefined}
          averageLabel={avgCurrentScore != null ? `Média da turma: ${Math.round(avgCurrentScore)}%` : undefined}
        />
        <Gauge
          label="Atividades entregues"
          valueLabel={summariesLoading ? '…' : summariesError ? '—' : dueCount > 0 ? `${Math.round(deliveryFraction * 100)}%` : '—'}
          fraction={summariesLoading || summariesError ? 0 : deliveryFraction}
          color={summariesLoading || summariesError ? 'var(--ink-soft)' : scoreColor(deliveryFraction * 100)}
          sublabel="Frente às atividades já vencidas"
          averageFraction={!summariesLoading && !summariesError && avgDeliveryFraction != null ? avgDeliveryFraction : undefined}
          averageLabel={avgDeliveryFraction != null ? `Média da turma: ${Math.round(avgDeliveryFraction * 100)}%` : undefined}
        />
        <Gauge
          label="Último acesso"
          valueLabel={formatLastAccessLabel(student.lastActivityAt)}
          fraction={lastAccessOwnFraction}
          color={spectrumColor(lastAccessOwnFraction)}
          sublabel="Verde = recente · vermelho = 30+ dias"
          averageFraction={avgLastAccessFraction}
          averageLabel={`Média da turma: ${formatDaysAgoLabel(Math.round(30 * (1 - avgLastAccessFraction)))}`}
          spectrum
        />
      </div>
      <p className="engagement-bar-legend">
        <span className="engagement-bar-avg-marker-legend" aria-hidden="true" /> Média da turma
      </p>

      {summariesError ? (
        <p className="alert alert-warning" role="status">
          {summariesError}
        </p>
      ) : (
        <div className="engagement-analytics-row">
          <div className="engagement-panel">
            <h5 className="engagement-panel-title">Atividades entregues</h5>
            {summariesLoading ? (
              <p className="lede">Carregando…</p>
            ) : (
              <div className="engagement-donut-wrap">
                <Donut segments={donutSegments} centerValue={`${delivered}/${dueCount}`} centerLabel="entregues" />
                <ul className="engagement-donut-legend">
                  {donutSegments.map((s) => (
                    <li key={s.key}>
                      <span className="engagement-legend-dot" style={{ background: s.color }} aria-hidden="true" />
                      {s.label} <strong>{s.value}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="engagement-panel">
            <h5 className="engagement-panel-title">Comparação com a média da turma</h5>
            {summariesLoading ? (
              <p className="lede">Carregando…</p>
            ) : (
              <>
                <CompareBar label="Visualizações de página" value={mySummary?.page_views || 0} average={avgPageViews} max={pageViewsMax} />
                <CompareBar label="Participações" value={mySummary?.participations || 0} average={avgParticipations} max={participationsMax} />
              </>
            )}
          </div>
        </div>
      )}

      <div className="engagement-panel">
        <h5 className="engagement-panel-title">Atividades — detalhe</h5>
        {assignments.loading ? (
          <p className="lede">Carregando…</p>
        ) : assignments.error ? (
          <p className="alert alert-warning" role="status">
            {assignments.error}
          </p>
        ) : assignments.data.length === 0 ? (
          <p className="lede">Nenhuma atividade encontrada.</p>
        ) : (
          <div className="engagement-assignment-list">
            {[...assignments.data]
              .sort((a, b) => new Date(b.due_at || 0) - new Date(a.due_at || 0))
              .map((a) => {
                const meta = STATUS_META[a.status] || STATUS_META.floating;
                const score = a.submission?.score;
                const scorePct = a.points_possible > 0 && score != null ? Math.min(100, (score / a.points_possible) * 100) : null;
                const medianPct = a.points_possible > 0 && a.median != null ? Math.min(100, (a.median / a.points_possible) * 100) : null;
                return (
                  <div className="engagement-assignment-row" key={a.assignment_id}>
                    <span className="engagement-status-dot" style={{ background: meta.color }} title={meta.label} />
                    <span className="engagement-assignment-title" title={a.title}>
                      {a.title}
                    </span>
                    <span className="engagement-assignment-due">{formatDate(a.due_at)}</span>
                    <span className="engagement-assignment-score">
                      {score != null ? `${score}/${a.points_possible ?? '—'}` : '—'}
                    </span>
                    <div className="engagement-assignment-bar-track">
                      {scorePct != null && <div className="engagement-assignment-bar-fill" style={{ width: `${scorePct}%` }} />}
                      {medianPct != null && (
                        <div
                          className="engagement-assignment-median-marker"
                          style={{ left: `${medianPct}%` }}
                          title={`Mediana da turma: ${a.median}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="engagement-panel">
        <EngagementHistoryChart courseId={courseId} studentId={student.id} />
      </div>

      {analysis.open && (
        <Modal title="Análise com IA" onClose={() => setAnalysis((s) => ({ ...s, open: false }))}>
          {analysis.loading && <p className="lede">Analisando…</p>}
          {analysis.error && (
            <p className="alert alert-warning" role="status">
              {analysis.error}
            </p>
          )}
          {analysis.notConfigured && (
            <a href="/perfil" className="engagement-ai-analysis-link">
              Ir para Perfil → Plataformas de IA
            </a>
          )}
          {analysis.text && <p className="engagement-ai-analysis-text">{analysis.text}</p>}
        </Modal>
      )}
    </div>
  );
}
