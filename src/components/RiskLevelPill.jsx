import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const CONFIG = {
  low: { label: 'Baixo', className: 'risk-pill-low' },
  medium: { label: 'Médio', className: 'risk-pill-medium' },
  high: { label: 'Alto', className: 'risk-pill-high' },
};

// A meaningful move needs to clear a small margin — otherwise two analyses
// a minute apart, with floating-point noise in the composite index, would
// flicker the arrow for no real change.
const TREND_EPSILON = 1;

function TrendArrow({ score, previousScore }) {
  if (previousScore == null || score == null) return null;
  const delta = score - previousScore;
  if (Math.abs(delta) < TREND_EPSILON) {
    return <Minus size={13} strokeWidth={2} className="risk-trend risk-trend-flat" aria-label="Sem mudança relevante desde a última análise" />;
  }
  if (delta > 0) {
    return <TrendingUp size={13} strokeWidth={2} className="risk-trend risk-trend-up" aria-label="Melhorou desde a última análise" />;
  }
  return <TrendingDown size={13} strokeWidth={2} className="risk-trend risk-trend-down" aria-label="Piorou desde a última análise" />;
}

// Soft-colored label (reuses the --ok/--warn/--err token pairs already
// backing .alert-success/.alert-warning/.alert-error — no new colors) plus
// the raw index value next to it, and an optional trend arrow comparing
// against the previous day's snapshot.
export default function RiskLevelPill({ level, score, previousScore }) {
  if (!level || score == null) return <span className="risk-empty">—</span>;
  const { label, className } = CONFIG[level];

  return (
    <span className="risk-cell-content">
      <span className={`risk-pill ${className}`}>{label}</span>
      <span className="risk-score">{Math.round(score)}</span>
      <TrendArrow score={score} previousScore={previousScore} />
    </span>
  );
}
