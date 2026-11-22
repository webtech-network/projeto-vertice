'use client';

import ActivityGradeLink from './ActivityGradeLink';

// Only ungraded activity shows here (the API already filters to
// needs_grading_count > 0, see derivePendingGradingItems in lib/dashboard.js)
// — as soon as a submission's corrected, it drops off this list on the next
// refresh instead of lingering as a stale "already handled" entry.
export default function PendingGradingList({ items, loading }) {
  return (
    <section className="dashboard-card">
      <h3>Pendências a corrigir</h3>
      {loading ? (
        <p className="lede">Carregando…</p>
      ) : !items || items.length === 0 ? (
        <p className="lede">Nenhuma atividade aguardando correção.</p>
      ) : (
        <ul className="card-list">
          {items.map((item) => (
            <ActivityGradeLink
              key={item.id}
              item={item}
              trailing={<span className="pending-badge has-pending">{item.needsGradingCount}</span>}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
