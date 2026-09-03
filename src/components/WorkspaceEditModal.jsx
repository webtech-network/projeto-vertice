'use client';

import { useEffect, useState } from 'react';
import { Check, FolderKanban, GraduationCap } from 'lucide-react';
import Modal from './Modal';
import { useWorkspaceScope } from './WorkspaceScopeProvider';
import { listProjects } from '@/lib/tasks/projectsRepo';
import { listCoursesCached } from '@/lib/tasks/canvasResolution';
import { filterActiveFavoriteCourses } from '@/lib/dashboard';
import { PROJECT_COLORS } from '@/lib/tasks/projectColors';

const TABS = [
  { key: 'project', label: 'Projetos', Icon: FolderKanban },
  { key: 'course', label: 'Cursos', Icon: GraduationCap },
];

// Edição de um workspace existente — nome, cor e associações (projetos e
// cursos) numa tela só, com um único "Salvar" para tudo. Substitui o par
// WorkspaceFormModal (nome/cor) + WorkspaceResourcesModal (associações, com
// "Salvar projetos"/"Salvar cursos" separados) que existia antes — a
// criação de um workspace novo continua simples (só nome/cor, via
// WorkspaceFormModal), já que não há resource pra associar antes dele
// existir.
export default function WorkspaceEditModal({ workspace, onClose }) {
  const { editWorkspace, getResourceIdsForWorkspace, setWorkspaceResourceIds } = useWorkspaceScope();

  const [name, setName] = useState(workspace.name);
  const [color, setColor] = useState(workspace.color);

  const [tab, setTab] = useState('project');
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const [selectedProjectIds, setSelectedProjectIds] = useState(() => getResourceIdsForWorkspace(workspace.id, 'project'));
  const [selectedCourseIds, setSelectedCourseIds] = useState(() => getResourceIdsForWorkspace(workspace.id, 'course'));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    listProjects().then((all) => setProjects(all.filter((p) => !p.deletedAt)));
  }, []);

  // Lazy, same as ProjectFormModal.jsx's own course fetch — only hit once
  // the Cursos tab is actually opened. Scoped to favoritos + publicados
  // (filterActiveFavoriteCourses, dashboard.js), same convention used
  // elsewhere for the same reason (cost/relevance).
  useEffect(() => {
    if (tab !== 'course' || courses.length > 0) return;
    setLoadingCourses(true);
    listCoursesCached()
      .then((all) => setCourses(filterActiveFavoriteCourses(all)))
      .finally(() => setLoadingCourses(false));
  }, [tab, courses.length]);

  function switchTab(key) {
    setTab(key);
    setQuery('');
  }

  function toggleProject(id) {
    setSelectedProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleCourse(id) {
    const key = String(id);
    setSelectedCourseIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await editWorkspace(workspace.id, { name: name.trim(), color });
      await setWorkspaceResourceIds(workspace.id, 'project', selectedProjectIds);
      await setWorkspaceResourceIds(workspace.id, 'course', selectedCourseIds);
      onClose();
    } catch (err) {
      setError(err.message || 'Falha ao salvar o ambiente.');
    } finally {
      setSaving(false);
    }
  }

  const term = query.trim().toLowerCase();
  const filteredProjects = projects.filter((p) => !term || p.name.toLowerCase().includes(term));
  const filteredCourses = courses.filter((c) => !term || c.name?.toLowerCase().includes(term));

  return (
    <Modal title={`Editar ambiente "${workspace.name}"`} onClose={onClose} preventBackdropClose={Boolean(name.trim())}>
      <form onSubmit={handleSave}>
        <label className="compose-message-field">
          <span>Nome</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do ambiente" />
        </label>

        <label className="compose-message-field">
          <span>Cor</span>
          <div className="project-color-picker" role="radiogroup" aria-label="Cor do ambiente">
            <button
              type="button"
              className={`project-color-swatch project-color-swatch--none${color === null ? ' active' : ''}`}
              onClick={() => setColor(null)}
              title="Sem cor"
              aria-label="Sem cor"
              role="radio"
              aria-checked={color === null}
            >
              {color === null && <Check size={14} strokeWidth={2.4} />}
            </button>
            {PROJECT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`project-color-swatch${color === c.hex ? ' active' : ''}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => setColor(c.hex)}
                title={c.label}
                aria-label={c.label}
                role="radio"
                aria-checked={color === c.hex}
              >
                {color === c.hex && <Check size={14} strokeWidth={2.4} color="#fff" />}
              </button>
            ))}
          </div>
        </label>

        <label className="compose-message-field">
          <span>Associações</span>
          <div className="tab-folder" role="tablist" aria-label="Tipo de item a associar">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`tab-folder-btn${tab === key ? ' active' : ''}`}
                onClick={() => switchTab(key)}
              >
                <Icon size={16} strokeWidth={1.8} />
                {label}
              </button>
            ))}
          </div>

          <div className="tab-folder-panel" role="tabpanel">
            <input
              type="search"
              className="search-input"
              placeholder={`Pesquisar ${tab === 'project' ? 'projetos' : 'cursos'}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={`Pesquisar ${tab === 'project' ? 'projetos' : 'cursos'}`}
            />

            {tab === 'project' &&
              (filteredProjects.length === 0 ? (
                <p className="lede">Nenhum projeto encontrado.</p>
              ) : (
                <ul className="workspace-multiselect-list">
                  {filteredProjects.map((project) => (
                    <li key={project.id} className="workspace-multiselect-row">
                      <label className="task-detail-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedProjectIds.includes(project.id)}
                          onChange={() => toggleProject(project.id)}
                        />
                        <span
                          className="tasks-projects-color-dot"
                          style={{ backgroundColor: project.color || 'transparent' }}
                          aria-hidden="true"
                        />
                        {project.name}
                      </label>
                    </li>
                  ))}
                </ul>
              ))}

            {tab === 'course' && (
              <span className="field-note">Somente cursos favoritados e publicados no Canvas aparecem aqui.</span>
            )}
            {tab === 'course' &&
              (loadingCourses ? (
                <p className="lede">Carregando cursos…</p>
              ) : filteredCourses.length === 0 ? (
                <p className="lede">Nenhum curso encontrado.</p>
              ) : (
                <ul className="workspace-multiselect-list">
                  {filteredCourses.map((course) => (
                    <li key={course.id} className="workspace-multiselect-row">
                      <label className="task-detail-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedCourseIds.includes(String(course.id))}
                          onChange={() => toggleCourse(course.id)}
                        />
                        {course.name}
                      </label>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        </label>

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        <div className="compose-message-actions">
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'Salvando…' : 'Salvar ambiente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
