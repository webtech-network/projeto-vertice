/**
 * Canvas adapter for the platform-agnostic model in ./scoring.js — the only
 * module that reads Canvas-specific fields. `row` is a StudentReport row
 * (see src/lib/studentReport.js's buildStudentRows); `summary` is one
 * entry of getStudentSummaries()'s response (src/lib/canvasClient.js),
 * matched to `row.id` by the caller.
 */

const ACCESS_RECENCY_FULL_SCORE_DAYS = 2;
const ACCESS_RECENCY_ZERO_SCORE_DAYS = 30;
// late/floating submissions still count for partial credit — a late
// submission is worse than on-time but meaningfully better than missing
// entirely; "floating" (Canvas's own term for a submission whose due-date
// relationship is unclear) sits closer to on-time than to late.
const TARDINESS_LATE_CREDIT = 0.6;
const TARDINESS_FLOATING_CREDIT = 0.8;
const LOW_GRADE_THRESHOLD = 60;

function unavailable() {
  return { score: null, available: false, raw: null, reasons: [] };
}

function computeDesempenho(row) {
  if (row.currentScore == null) return unavailable();
  const score = Math.min(100, Math.max(0, row.currentScore));
  const reasons = score < LOW_GRADE_THRESHOLD ? [`Nota atual (${Math.round(score)}) abaixo de ${LOW_GRADE_THRESHOLD}`] : [];
  return { score, available: true, raw: { currentScore: row.currentScore }, reasons };
}

function computeEntrega(summary) {
  const breakdown = summary?.tardiness_breakdown;
  if (!breakdown) return unavailable();
  const { missing = 0, late = 0, on_time = 0, floating = 0 } = breakdown;
  const total = missing + late + on_time + floating;
  if (total === 0) return unavailable();

  const score = (100 * (on_time + TARDINESS_LATE_CREDIT * late + TARDINESS_FLOATING_CREDIT * floating)) / total;
  const reasons = [];
  if (missing > 0) reasons.push(`${missing} de ${total} atividade${total === 1 ? '' : 's'} faltando`);
  if (late > 0) reasons.push(`${late} atividade${late === 1 ? '' : 's'} entregue${late === 1 ? '' : 's'} com atraso`);

  return { score, available: true, raw: { missing, late, on_time, floating, total }, reasons };
}

// Canvas's own page_views_level/participations_level are already a 0-3
// bucket relative to the rest of the class, so mapping to 0/33/66/100 keeps
// that same relative meaning instead of inventing an absolute scale.
function levelToScore(level) {
  return level == null ? null : Math.min(100, (level / 3) * 100);
}

function daysSince(iso) {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

function recencyScore(lastActivityAt) {
  if (!lastActivityAt) return null;
  const days = daysSince(lastActivityAt);
  if (days <= ACCESS_RECENCY_FULL_SCORE_DAYS) return 100;
  if (days >= ACCESS_RECENCY_ZERO_SCORE_DAYS) return 0;
  const span = ACCESS_RECENCY_ZERO_SCORE_DAYS - ACCESS_RECENCY_FULL_SCORE_DAYS;
  return 100 * (1 - (days - ACCESS_RECENCY_FULL_SCORE_DAYS) / span);
}

function computeAcesso(row, summary) {
  const pageViewsScore = levelToScore(summary?.page_views_level);
  const participationsScore = levelToScore(summary?.participations_level);
  const recency = recencyScore(row.lastActivityAt);
  const parts = [pageViewsScore, participationsScore, recency].filter((v) => v != null);
  if (parts.length === 0) return unavailable();

  const score = parts.reduce((sum, v) => sum + v, 0) / parts.length;
  const reasons = [];
  if (recency != null && recency < 40) {
    const days = Math.round(daysSince(row.lastActivityAt));
    reasons.push(`Sem acesso ao curso há ${days} dia${days === 1 ? '' : 's'}`);
  }
  if (pageViewsScore === 0) reasons.push('Menor nível de acessos ao curso, comparado à turma');

  return {
    score,
    available: true,
    raw: { pageViewsLevel: summary?.page_views_level, participationsLevel: summary?.participations_level, lastActivityAt: row.lastActivityAt },
    reasons,
  };
}

export function computeCanvasDimensions({ row, summary }) {
  return {
    desempenho: computeDesempenho(row),
    entrega: computeEntrega(summary),
    acesso: computeAcesso(row, summary),
  };
}
