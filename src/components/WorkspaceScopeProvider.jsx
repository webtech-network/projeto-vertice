'use client';

import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import {
  BASE_WORKSPACE_ID,
  BASE_WORKSPACE,
  listWorkspaces,
  listAllLinks,
  createWorkspace as repoCreateWorkspace,
  updateWorkspace as repoUpdateWorkspace,
  deleteWorkspace as repoDeleteWorkspace,
  setResourceWorkspaces as repoSetResourceWorkspaces,
  setWorkspaceResources as repoSetWorkspaceResources,
} from '@/lib/workspaces/workspacesRepo';
import { getActiveWorkspaceId, setActiveWorkspaceId as persistActiveWorkspaceId } from '@/lib/workspaces/activeWorkspacePreference';

const WorkspaceScopeContext = createContext(null);

// Mounted in (dashboard)/layout.jsx (not a single page, unlike
// TasksProvider) — the workspace switcher lives in Topbar.jsx, and the
// scope filter needs to reach every dashboard route without remounting on
// client-side navigation between them.
//
// Fase 1: workspacesRepo.js agora lê/escreve direto no Postgres (RLS-scoped)
// — a sincronização via Google Drive (scheduleWorkspacesSync/
// flushWorkspacesSyncNow) foi removida daqui pelo mesmo motivo de
// TasksProvider.jsx: o Postgres já é a fonte autoritativa por si só.
export function WorkspaceScopeProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([BASE_WORKSPACE]);
  const [links, setLinks] = useState([]);
  // Starts at Base on the server and on first client render (SSR-safe, same
  // reasoning as tasksViewPreferences.js) — the real localStorage value is
  // read only after mount, in the effect below.
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState(BASE_WORKSPACE_ID);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    const [ws, ls] = await Promise.all([listWorkspaces(), listAllLinks()]);
    setWorkspaces(ws);
    setLinks(ls.filter((l) => !l.deletedAt));
    setLoading(false);
  }, []);

  useEffect(() => {
    hydrate();
    setActiveWorkspaceIdState(getActiveWorkspaceId());
  }, [hydrate]);

  // Defends against the active workspace having been deleted on another
  // device and the tombstone arriving via sync — falls back to Base rather
  // than pointing at a workspace that no longer exists.
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || BASE_WORKSPACE;

  const setActiveWorkspaceId = useCallback(
    (id) => {
      persistActiveWorkspaceId(id);
      setActiveWorkspaceIdState(id);
    },
    [],
  );

  const addWorkspace = useCallback(async ({ name, color = null }) => {
    const workspace = await repoCreateWorkspace({ name, color });
    setWorkspaces((prev) => [...prev, workspace]);
    return workspace;
  }, []);

  const editWorkspace = useCallback(async (id, patch) => {
    const workspace = await repoUpdateWorkspace(id, patch);
    if (workspace) {
      setWorkspaces((prev) => prev.map((w) => (w.id === id ? workspace : w)));
    }
    return workspace;
  }, []);

  const removeWorkspace = useCallback(
    async (id) => {
      await repoDeleteWorkspace(id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      if (activeWorkspaceId === id) setActiveWorkspaceId(BASE_WORKSPACE_ID);
    },
    [activeWorkspaceId, setActiveWorkspaceId],
  );

  const getWorkspaceIdsForResource = useCallback(
    (resourceType, resourceId) => {
      const id = String(resourceId);
      return links.filter((l) => l.resourceType === resourceType && l.resourceId === id).map((l) => l.workspaceId);
    },
    [links],
  );

  const setResourceWorkspaces = useCallback(async (resourceType, resourceId, workspaceIds) => {
    await repoSetResourceWorkspaces(resourceType, resourceId, workspaceIds);
    const freshLinks = await listAllLinks();
    setLinks(freshLinks.filter((l) => !l.deletedAt));
  }, []);

  // The mirror image of getWorkspaceIdsForResource/setResourceWorkspaces
  // above — backs WorkspaceResourcesModal.jsx's tabbed picker, which manages
  // membership from a single workspace's side (all its projects, all its
  // courses) rather than one resource at a time.
  const getResourceIdsForWorkspace = useCallback(
    (workspaceId, resourceType) =>
      links.filter((l) => l.workspaceId === workspaceId && l.resourceType === resourceType).map((l) => l.resourceId),
    [links],
  );

  const setWorkspaceResourceIds = useCallback(async (workspaceId, resourceType, resourceIds) => {
    await repoSetWorkspaceResources(workspaceId, resourceType, resourceIds);
    const freshLinks = await listAllLinks();
    setLinks(freshLinks.filter((l) => !l.deletedAt));
  }, []);

  // The central scope-filtering helper — `null` means "no filter" (Base
  // active), otherwise a Set of resourceIds linked to the active workspace.
  // KanbanBoard.jsx/EisenhowerMatrix.jsx/TaskTable.jsx and CourseBrowser.jsx
  // all call this the same way.
  const getVisibleResourceIds = useCallback(
    (resourceType) => {
      if (activeWorkspaceId === BASE_WORKSPACE_ID) return null;
      return new Set(
        links.filter((l) => l.resourceType === resourceType && l.workspaceId === activeWorkspaceId).map((l) => l.resourceId),
      );
    },
    [links, activeWorkspaceId],
  );

  const value = {
    workspaces,
    links,
    activeWorkspaceId,
    activeWorkspace,
    setActiveWorkspaceId,
    addWorkspace,
    editWorkspace,
    removeWorkspace,
    getWorkspaceIdsForResource,
    setResourceWorkspaces,
    getResourceIdsForWorkspace,
    setWorkspaceResourceIds,
    getVisibleResourceIds,
    loading,
  };

  return <WorkspaceScopeContext.Provider value={value}>{children}</WorkspaceScopeContext.Provider>;
}

export function useWorkspaceScope() {
  return useContext(WorkspaceScopeContext);
}
