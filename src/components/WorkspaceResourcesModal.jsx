'use client';

import { useEffect, useState } from 'react';
import { FolderKanban, GraduationCap } from 'lucide-react';
import Modal from './Modal';
import { useWorkspaceScope } from './WorkspaceScopeProvider';
import { listProjects } from '@/lib/tasks/projectsRepo';
import { listCoursesCached } from '@/lib/tasks/canvasResolution';
import { filterActiveFavoriteCourses } from '@/lib/dashboard';

// One tab per associable resource type — the centralized, workspace-side
// counterpart to ResourceWorkspacesModal.jsx (which goes the other way,
// picking workspaces for a single resource). Adding a future resource type
// here means adding one entry to TABS plus its own fetch-and-render branch
// below, same shape as the two already in place; the underlying
// setWorkspaceResourceIds/getResourceIdsForWorkspace calls are already
// resourceType-agnostic.
const TABS = [
  { key: 'project', label: 'Projetos', Icon: FolderKanban },
  { key: 'course', label: 'Cursos', Icon: GraduationCap },
];

export default function WorkspaceResourcesModal({ workspace, onClose }) {
  const { getResourceIdsForWorkspace, setWorkspaceResourceIds } = useWorkspaceScope();
  const [tab, setTab] = useState('project');
  const [query, setQuery] = useState('');

  const [projects, setProjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const [selectedProjectIds, setSelectedProjectIds] = useState(() => getResourceIdsForWorkspace(workspace.id, 'project'));
  const [selectedCourseIds, setSelectedCourseIds] = useState(() => getResourceIdsForWorkspace(workspace.id, 'course'));

  const [savingProjects, setSavingProjects] = useState(false);
  const [savingCourses, setSavingCourses] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    listProjects().then((all) => setProjects(all.filter((p) => !p.deletedAt)));
  }, []);

  // Lazy, same as ProjectFormModal.jsx's own course fetch — only hit once
  // the Cursos tab is actually opened, not on every workspace management
  // modal open. Scoped to favoritos + publicados (filterActiveFavoriteCourses,
  // dashboard.js) — same "favorites only, for cost/relevance reasons"
  // convention ProjectFormModal.jsx's own course dropdown already uses,
  // narrowed further to published courses since an unpublished course isn't
  // something a professor is actively organizing into workspaces yet.
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

  async function saveProjects() {
    setSavingProjects(true);
    setError(null);
    try {
      await setWorkspaceResourceIds(workspace.id, 'project', selectedProjectIds);
    } catch (err) {
      setError(err.message || 'Falha ao salvar os projetos.');
    } finally {
      setSavingProjects(false);
    }
  }

  async function saveCourses() {
    setSavingCourses(true);
    setError(null);
    try {
      await setWorkspaceResourceIds(workspace.id, 'course', selectedCourseIds);
    } catch (err) {
      setError(err.message || 'Falha ao salvar os cursos.');
    } finally {
      setSavingCourses(false);
    }
  }

  const term = query.trim().toLowerCase();
  const filteredProjects = projects.filter((p) => !term || p.name.toLowerCase().includes(term));
  const filteredCourses = courses.filter((c) => !term || c.name?.toLowerCase().includes(term));

  return (
    <Modal title={`Itens do workspace "${workspace.name}"`} onClose={onClose}>
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
          <span className="field-note">
            Somente cursos favoritados e publicados no Canvas aparecem aqui.
          </span>
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

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        <div className="compose-message-actions">
          {tab === 'project' ? (
            <button type="button" className="btn btn-primary btn-sm" disabled={savingProjects} onClick={saveProjects}>
              {savingProjects ? 'Salvando…' : 'Salvar projetos'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" disabled={savingCourses} onClick={saveCourses}>
              {savingCourses ? 'Salvando…' : 'Salvar cursos'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
