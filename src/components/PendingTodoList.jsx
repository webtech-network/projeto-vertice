'use client';

import { ExternalLink } from 'lucide-react';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return '—';
  }
}

// "A fazer" do aluno (ADR-0022): atividades com prazo ainda não entregues,
// vencidas primeiro. Cada linha abre a atividade no Canvas (o aluno entrega
// lá; não existe página de correção do Vértice para ele).
export default function PendingTodoList({ items, loading }) {
  return (
    <section className="dashboard-card">
      <h3>Pendências a fazer</h3>
      {loading ? (
        <p className="lede">Carregando…</p>
      ) : !items || items.length === 0 ? (
        <p className="lede">Nenhuma atividade a fazer.</p>
      ) : (
        <ul className="card-list">
          {items.map((item) => (
            <li
              key={item.id}
              className="card-link"
              role="link"
              tabIndex={0}
              onClick={() => window.open(item.htmlUrl, '_blank', 'noopener,noreferrer')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  window.open(item.htmlUrl, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              <span className="card-link-text">
                <span className="card-meta">{item.courseName}</span>
                <span className="card-title">
                  {item.name}
                  <ExternalLink size={13} strokeWidth={1.8} aria-hidden="true" />
                </span>
              </span>
              <span className={`deadline-tag ${item.overdue ? 'overdue' : 'upcoming'}`}>
                {item.overdue ? 'Atrasada' : 'Em breve'} · {formatDate(item.dueAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
