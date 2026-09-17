/**
 * Platform-agnostic aggregation of normalized engagement dimensions into a
 * composite index (0-100) and a risk level relative to the class's own
 * distribution. Never reads a platform-specific field directly — that's
 * canvasSource.js's job (see CLAUDE.md's "Nível de risco do aluno"
 * section). A future non-Canvas source would export the same
 * `{dimensionKey: {score, available, raw, reasons}}` shape and this module
 * wouldn't need to change.
 */

// No UI to tune these yet (product decision — see CLAUDE.md) — equal
// weight for all three dimensions until there's a reason to differentiate.
export const DEFAULT_WEIGHTS = { desempenho: 1, entrega: 1, acesso: 1 };

/**
 * Weighted average over only the *available* dimensions, renormalized so a
 * missing dimension (e.g. an account that doesn't expose grades) doesn't
 * silently drag the score toward zero — the other dimensions absorb its
 * weight proportionally instead. `coverage` (0-1) is how much of the total
 * weight was actually backed by data; callers use it to exclude
 * zero-coverage students from the class's quartile calculation.
 */
export function computeIndex(dimensionScores, weights = DEFAULT_WEIGHTS) {
  let weightedSum = 0;
  let availableWeight = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    totalWeight += weight;
    const dimension = dimensionScores[key];
    if (!dimension?.available) continue;
    weightedSum += weight * dimension.score;
    availableWeight += weight;
  }

  return {
    score: availableWeight > 0 ? weightedSum / availableWeight : null,
    coverage: totalWeight > 0 ? availableWeight / totalWeight : 0,
  };
}

// Linear-interpolation percentile (same method as Excel's PERCENTILE.INC /
// numpy's default) — plenty accurate for a quartile split, no stats
// library needed. `sorted` must already be sorted ascending.
function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/** `scores` is the composite Índice of every eligible student (coverage > 0, active enrollment). */
export function computeQuartiles(scores) {
  const sorted = [...scores].sort((a, b) => a - b);
  return { q1: percentile(sorted, 0.25), q3: percentile(sorted, 0.75) };
}

/**
 * Risk level relative to THIS class's own quartiles, not an absolute cutoff
 * — a student's label can shift between two analyses even if their own
 * score barely moved, if the rest of the class moved more. That's the
 * intended behavior (see the "Como o Nível de Risco é calculado" info
 * hint), not a bug.
 */
export function classifyRisk(score, { q1, q3 }) {
  if (score == null || q1 == null || q3 == null) return null;
  // Degenerate case (no spread at all — e.g. every student tied): nothing
  // meaningfully separates the class, so nobody gets flagged either way.
  if (q1 === q3) return 'medium';
  if (score <= q1) return 'high';
  if (score >= q3) return 'low';
  return 'medium';
}

/**
 * Human-readable sentence explaining why a student landed in their risk
 * level — their index's position relative to THIS analysis's own class
 * quartiles (see classifyRisk above). `result` is one entry of
 * StudentReport.jsx's `engagement.results` map; `quartiles` is
 * `engagement.quartiles`.
 */
export function describeRiskPosition(result, quartiles) {
  if (!result?.riskLevel || !quartiles) return null;
  const score = Math.round(result.score);
  const q1 = Math.round(quartiles.q1);
  const q3 = Math.round(quartiles.q3);
  if (result.riskLevel === 'high') {
    return `Índice ${score} está no quartil inferior da turma (≤ ${q1}) — entre os 25% com pior índice nesta análise.`;
  }
  if (result.riskLevel === 'low') {
    return `Índice ${score} está no quartil superior da turma (≥ ${q3}) — entre os 25% com melhor índice nesta análise.`;
  }
  return `Índice ${score} está na faixa intermediária da turma (entre ${q1} e ${q3} nesta análise).`;
}
