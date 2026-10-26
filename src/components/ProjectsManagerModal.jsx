'use client';

import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import Modal from './Modal';
import ProjectFormModal from './ProjectFormModal';
import { useTasks } from './TasksProvider';

// Spec section 7's "PROJETOS" panel — view + maintain every registered
// project, grouped Canvas vs Pessoais, with edit/delete per row. Creation
// reuses the same ProjectFormModal.jsx the top-level "+ Novo projeto"
// trigger opens, just stacked on top of this one (same nested-modal pattern
// TaskDetailModal.jsx already uses for its own "+ Novo projeto" shortcut).
export default function ProjectsManagerModal({ onClose }) {
  const { projects, tasks, removeProject } = useTasks();
  const [editingProject, setEditingProject] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const canvasProjects = useMemo(() => projects.filter((p) => p.type === 'canvas-course'), [projects]);
  const personalProjects = useMemo(() => projects.filter((p) => p.type !== 'canvas-course'), [projects]);

  function taskCountFor(projectId) {
    return tasks.filter((t) => t.projectId === projectId).length;
  }

  async function handleDelete(project) {
    const count = taskCountFor(project.id);
    const warning =
      count > 0
        ? ` ${count} tarefa${count > 1 ? 's' : ''} vinculada${count > 1 ? 's' : ''} a ele ${count > 1 ? 'ficarão' : 'ficará'} sem projeto.`
        : '';
    if (!window.confirm(`Excluir o projeto "${project.name}"?${warning}`)) return;
    setDeletingId(project.id);
    try {
      await removeProject(project.id);
    } finally {
      setDeletingId(null);
    }
  }

  function renderGroup(title, group) {
    if (group.length === 0) return null;
    return (
      <div className="tasks-projects-group">
        <h3>{title}</h3>
        <ul className="tasks-projects-list">
          {group.map((project) => (
            <li key={project.id} className="tasks-projects-row">
              <span
                className="tasks-projects-color-dot"
                style={{ backgroundColor: project.color || 'transparent' }}
                aria-hidden="true"
              />
              <span className="tasks-projects-name">{project.name}</span>
              <span className="tasks-projects-count">{taskCountFor(project.id)} tarefa(s)</span>
              <span className="tasks-projects-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-icon btn-sm"
                  title="Editar projeto"
                  aria-label={`Editar projeto ${project.name}`}
                  onClick={() => setEditingProject(project)}
                >
                  <Pencil size={14} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-icon btn-sm"
                  title="Excluir projeto"
                  aria-label={`Excluir projeto ${project.name}`}
                  disabled={deletingId === project.id}
                  onClick={() => handleDelete(project)}
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <>
      <Modal title="Projetos" onClose={onClose}>
        <div className="compose-message-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            <Plus size={15} strokeWidth={1.8} />
            Novo projeto
          </button>
        </div>

        {projects.length === 0 ? (
          <p className="lede">Nenhum projeto cadastrado ainda.</p>
        ) : (
          <>
            {renderGroup('Canvas', canvasProjects)}
            {renderGroup('Pessoais', personalProjects)}
          </>
        )}
      </Modal>

      {creating && <ProjectFormModal onClose={() => setCreating(false)} />}
      {editingProject && <ProjectFormModal project={editingProject} onClose={() => setEditingProject(null)} />}
    </>
  );
}
