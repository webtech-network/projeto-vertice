import { ExternalLink } from 'lucide-react';
import { speedGraderUrl } from '@/lib/canvasLinks';
import ActivityGradeLink from './ActivityGradeLink';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return '—';
  }
}

// Renders deriveRecentWindow()'s up-to-5 items (see src/lib/dashboard.js):
// up to 2 most-recent-past + the rest upcoming, within a ±7 day window.
// Each row uses the shared ActivityGradeLink (see that file) so clicking the
// row itself opens the activity's grading page inside Vértice; the
// trailing SpeedGrader icon here is this card's own addition on top of that
// shared component — `baseUrl` is derived from the item's own `htmlUrl`
// (RecentDeadlines has no session.baseUrl of its own to work with, unlike
// canvasLinks.js's other callers, so the item's already-absolute Canvas URL
// is the only domain we have on hand).
export default function RecentDeadlines({ items, loading }) {
  const now = Date.now();

  return (
    <section className="dashboard-card">
      <h3>Atividades recentes</h3>
      {loading ? (
        <p className="lede">Carregando…</p>
      ) : !items || items.length === 0 ? (
        <p className="lede">Nenhuma atividade com prazo nos últimos ou próximos 7 dias.</p>
      ) : (
        <ul className="card-list">
          {items.map((item) => {
            const overdue = new Date(item.dueAt).getTime() < now;
            const baseUrl = new URL(item.htmlUrl).origin;
            return (
              <ActivityGradeLink
                key={item.id}
                item={item}
                showCanvasLink={false}
                trailing={
                  <span className="deadline-trailing">
                    <a
                      href={speedGraderUrl(baseUrl, item.courseId, item.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-link-icon"
                      title="Abrir no SpeedGrader"
                      aria-label="Abrir no SpeedGrader"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={14} strokeWidth={1.8} />
                    </a>
                    <span className={`deadline-tag${overdue ? ' overdue' : ' upcoming'}`}>{formatDate(item.dueAt)}</span>
                  </span>
                }
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
