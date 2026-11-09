'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Flag, Zap, ArrowRight } from 'lucide-react';
import { fetchActiveProjects, fetchActiveTasks, localDataKeys } from '@/lib/query/localData';

const EMPTY = [];

// Never gated on DashboardPanel's Canvas fetch. Reads the same cache keys
// TasksProvider mirrors its state into (ADR-0017): paints at once from what
// was saved (IndexedDB) and always revalidates against Postgres on mount
// (staleTime 0 — a personal-scale query, cheap).
export default function DashboardDoingTasks() {
  const tasksQuery = useQuery({ queryKey: localDataKeys.tasks, queryFn: fetchActiveTasks, staleTime: 0 });
  const projectsQuery = useQuery({ queryKey: localDataKeys.projects, queryFn: fetchActiveProjects, staleTime: 0 });
  const tasks = (tasksQuery.data ?? EMPTY).filter((t) => t.status === 'DOING');
  const projects = projectsQuery.data ?? EMPTY;
  const loading = tasksQuery.data === undefined && tasksQuery.isPending;

  return (
    <section className="dashboard-card">
      <div className="dashboard-card-header">
        <h3>Tarefas em andamento</h3>
        <Link href="/tarefas" className="btn btn-ghost btn-sm" title="Painel de tarefas" aria-label="Painel de tarefas">
          <ArrowRight size={14} strokeWidth={1.8} />
          <span className="dashboard-card-header-btn-text">Painel</span>
        </Link>
      </div>

      {loading ? (
        <p className="lede">Carregando…</p>
      ) : tasks.length === 0 ? (
        <p className="lede">
          Nenhuma tarefa em <em>doing</em> no momento. Organize suas tarefas em <Link href="/tarefas">/tarefas</Link>.
        </p>
      ) : (
        <ul className="card-list">
          {tasks.map((task) => {
            const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
            return (
              <li key={task.id}>
                <Link href="/tarefas" className="card-link">
                  <span className="card-link-text">
                    <span className="card-meta">{project ? project.name : 'Sem projeto'}</span>
                    <span className="card-title">{task.title}</span>
                  </span>
                  {(task.priority?.important || task.priority?.urgent) && (
                    <span className="kanban-card-classification">
                      {task.priority?.important && (
                        <span className="kanban-card-flag" title="Importante">
                          <Flag size={13} strokeWidth={1.8} />
                        </span>
                      )}
                      {task.priority?.urgent && (
                        <span className="kanban-card-urgent" title="Urgente">
                          <Zap size={13} strokeWidth={1.8} />
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
