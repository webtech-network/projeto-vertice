'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Settings2, Check } from 'lucide-react';
import { useWorkspaceScope } from './WorkspaceScopeProvider';
import WorkspaceFormModal from './WorkspaceFormModal';
import WorkspaceManagerModal from './WorkspaceManagerModal';

// Global workspace filter selector — same click-outside/Escape-to-close
// popover pattern as UserMenu.jsx/SyncStatusIndicator.jsx, its neighbors in
// Topbar.jsx. Selecting a workspace here is what every scope-aware screen
// (Tarefas, Cursos/Atividades, Notas de curso) filters by.
export default function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspaceId, loading } = useWorkspaceScope();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (loading) return null;

  // Same position-based numbering WorkspaceScopeProvider.jsx's Alt+1..9
  // handler uses — only the first 9 workspaces get a shortcut/badge, same
  // ceiling as Chrome's own numbered-tab shortcuts.
  const activeIndex = workspaces.findIndex((w) => w.id === activeWorkspace.id);

  return (
    <div className="workspace-switcher" ref={containerRef}>
      <button
        type="button"
        className="workspace-switcher-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={activeIndex >= 0 && activeIndex < 9 ? `Workspace ativo (Alt+${activeIndex + 1})` : 'Workspace ativo'}
      >
        <span
          className="tasks-projects-color-dot"
          style={{ backgroundColor: activeWorkspace.color || 'var(--ink-soft)' }}
          aria-hidden="true"
        />
        <span className="workspace-switcher-label">{activeWorkspace.name}</span>
        <ChevronDown size={14} strokeWidth={1.8} />
      </button>

      {open && (
        <div className="workspace-switcher-popover" role="menu">
          <ul className="workspace-switcher-list">
            {workspaces.map((workspace, index) => (
              <li key={workspace.id}>
                <button
                  type="button"
                  className={`workspace-switcher-item${workspace.id === activeWorkspace.id ? ' active' : ''}`}
                  role="menuitemradio"
                  aria-checked={workspace.id === activeWorkspace.id}
                  title={index < 9 ? `Alt+${index + 1}` : undefined}
                  onClick={() => {
                    setActiveWorkspaceId(workspace.id);
                    setOpen(false);
                  }}
                >
                  {index < 9 && <span className="workspace-switcher-number">{index + 1}</span>}
                  <span
                    className="tasks-projects-color-dot"
                    style={{ backgroundColor: workspace.color || 'var(--ink-soft)' }}
                    aria-hidden="true"
                  />
                  {workspace.name}
                  {workspace.id === activeWorkspace.id && <Check size={14} strokeWidth={2.2} />}
                </button>
              </li>
            ))}
          </ul>

          <div className="workspace-switcher-actions">
            <button
              type="button"
              className="user-menu-item"
              role="menuitem"
              onClick={() => {
                setCreating(true);
                setOpen(false);
              }}
            >
              <Plus size={15} strokeWidth={1.8} aria-hidden="true" /> Novo workspace
            </button>
            <button
              type="button"
              className="user-menu-item"
              role="menuitem"
              onClick={() => {
                setManaging(true);
                setOpen(false);
              }}
            >
              <Settings2 size={15} strokeWidth={1.8} aria-hidden="true" /> Gerenciar workspaces
            </button>
          </div>
        </div>
      )}

      {creating && <WorkspaceFormModal onClose={() => setCreating(false)} />}
      {managing && <WorkspaceManagerModal onClose={() => setManaging(false)} />}
    </div>
  );
}
