'use client';

import { useEffect, useRef, useState } from 'react';
import { Circle } from 'lucide-react';
import { listEngagementHistory } from '@/lib/studentEngagement/studentEngagementRepo';

const RISK_COLOR = { low: 'var(--ok)', medium: 'var(--warn)', high: 'var(--err)' };
const RISK_LABEL = { low: 'Baixo', medium: 'Médio', high: 'Alto' };

// Fixed 0-100 domain (never auto-scaled to the data's own min/max) — the
// index's meaning is anchored to that scale (see scoring.js), and
// auto-scaling would visually exaggerate small movements.
const WIDTH = 420;
const HEIGHT = 150;
const PADDING = { top: 14, right: 16, bottom: 24, left: 30 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

function formatShortDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function xFor(index, count) {
  if (count <= 1) return PADDING.left + PLOT_WIDTH / 2;
  return PADDING.left + (index / (count - 1)) * PLOT_WIDTH;
}

function yFor(score) {
  return PADDING.top + (1 - score / 100) * PLOT_HEIGHT;
}

// Self-contained: fetches its own history on mount (courseId/studentId only
// known once a row is expanded) rather than lifting fetch state up into
// StudentReport.jsx — this widget owns its own loading/error/hover state
// and nothing outside it needs to react to that state.
export default function EngagementHistoryChart({ courseId, studentId }) {
  const [state, setState] = useState({ status: 'loading', data: [] });
  const [hoverIndex, setHoverIndex] = useState(null);
  const [tableView, setTableView] = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    listEngagementHistory(courseId, studentId)
      .then((data) => {
        if (!cancelled) setState({ status: 'loaded', data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', data: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, studentId]);

  if (state.status === 'loading') return <p className="lede">Carregando histórico…</p>;
  if (state.status === 'error') {
    return (
      <p className="alert alert-error" role="alert">
        Falha ao carregar o histórico deste aluno.
      </p>
    );
  }
  if (state.data.length === 0) {
    return <p className="lede">Ainda não há histórico — o índice é salvo a cada vez que "Analisar situação dos alunos" é usado.</p>;
  }

  const points = state.data;
  const latest = points[points.length - 1];
  const hovered = hoverIndex != null ? points[hoverIndex] : null;
  // At most ~5 date labels along X, to avoid collisions in this small a chart.
  const labelStep = Math.max(1, Math.ceil(points.length / 5));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i, points.length)} ${yFor(p.score)}`).join(' ');

  function handlePointerMove(e) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((_, i) => {
      const dist = Math.abs(xFor(i, points.length) - x);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <div className="engagement-history">
      <div className="engagement-history-header">
        <span className="engagement-history-title">Histórico do índice</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTableView((v) => !v)}>
          {tableView ? 'Ver gráfico' : 'Ver como tabela'}
        </button>
      </div>

      {tableView ? (
        <table className="data-table engagement-history-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Índice</th>
              <th>Nível</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.snapshotDate}>
                <td>{formatShortDate(p.snapshotDate)}</td>
                <td>{Math.round(p.score)}</td>
                <td>{RISK_LABEL[p.riskLevel] || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="engagement-history-svg"
            role="img"
            aria-label={`Histórico do índice de risco, de ${formatShortDate(points[0].snapshotDate)} a ${formatShortDate(latest.snapshotDate)}, terminando em ${Math.round(latest.score)}`}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            {[0, 50, 100].map((tick) => (
              <g key={tick}>
                <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={yFor(tick)} y2={yFor(tick)} className="chart-gridline" />
                <text x={PADDING.left - 6} y={yFor(tick)} className="chart-axis-label" textAnchor="end" dominantBaseline="middle">
                  {tick}
                </text>
              </g>
            ))}

            {points.map((p, i) =>
              i % labelStep === 0 || i === points.length - 1 ? (
                <text key={p.snapshotDate} x={xFor(i, points.length)} y={HEIGHT - 6} className="chart-axis-label" textAnchor="middle">
                  {formatShortDate(p.snapshotDate)}
                </text>
              ) : null,
            )}

            <path d={linePath} className="chart-line" fill="none" />

            {points.map((p, i) => (
              <circle
                key={p.snapshotDate}
                cx={xFor(i, points.length)}
                cy={yFor(p.score)}
                r={i === points.length - 1 ? 5 : 3}
                fill={RISK_COLOR[p.riskLevel] || 'var(--ink-soft)'}
                stroke="var(--paper)"
                strokeWidth={2}
              />
            ))}

            <text x={xFor(points.length - 1, points.length)} y={yFor(latest.score) - 10} className="chart-end-label" textAnchor="end">
              {Math.round(latest.score)}
            </text>

            {hovered && (
              <line
                x1={xFor(hoverIndex, points.length)}
                x2={xFor(hoverIndex, points.length)}
                y1={PADDING.top}
                y2={HEIGHT - PADDING.bottom}
                className="chart-crosshair"
              />
            )}
          </svg>

          <p className="engagement-history-readout" aria-live="polite">
            {hovered ? (
              <>
                <strong>{Math.round(hovered.score)}</strong> — {formatShortDate(hovered.snapshotDate)} · {RISK_LABEL[hovered.riskLevel] || '—'}
              </>
            ) : (
              'Passe o cursor sobre o gráfico para ver um ponto específico.'
            )}
          </p>

          <ul className="icon-legend">
            <li>
              <Circle size={10} fill="var(--ok)" strokeWidth={0} aria-hidden="true" /> Baixo
            </li>
            <li>
              <Circle size={10} fill="var(--warn)" strokeWidth={0} aria-hidden="true" /> Médio
            </li>
            <li>
              <Circle size={10} fill="var(--err)" strokeWidth={0} aria-hidden="true" /> Alto
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
