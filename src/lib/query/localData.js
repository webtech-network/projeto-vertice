import { useEffect, useRef } from 'react';
import { listTasks } from '../tasks/tasksRepo';
import { listProjects } from '../tasks/projectsRepo';
import { listWorkspaces, listAllLinks } from '../workspaces/workspacesRepo';
import { getQueryClient, waitForCacheRestore } from './queryClient';

// Dados próprios (Postgres) espelhados no cache de consultas — ADR-0017.
// Os providers (TasksProvider, WorkspaceScopeProvider) continuam donos do
// estado; aqui ficam as chaves, os fetchers (só itens não deletados, no mesmo
// formato que os providers guardam) e os helpers de leitura/espelho.

export const localDataKeys = {
  tasks: ['local', 'tasks'],
  projects: ['local', 'projects'],
  workspaces: ['local', 'workspaces'],
  workspaceLinks: ['local', 'workspace-links'],
};

export const fetchActiveTasks = () => listTasks().then((tasks) => tasks.filter((t) => !t.deletedAt));
export const fetchActiveProjects = () => listProjects().then((projects) => projects.filter((p) => !p.deletedAt));
// Já vem sem deletados e com o Base sintético na frente.
export const fetchWorkspaces = () => listWorkspaces();
export const fetchActiveLinks = () => listAllLinks().then((links) => links.filter((l) => !l.deletedAt));

// O que estava salvo (depois da restauração do IndexedDB), ou undefined.
export async function readLocalCache(queryKey) {
  await waitForCacheRestore();
  return getQueryClient().getQueryData(queryKey);
}

// Grava o estado atual do provider no cache (e, por tabela, no IndexedDB).
export function mirrorLocalCache(queryKey, data) {
  getQueryClient().setQueryData(queryKey, data);
}

const HIDDEN_REVALIDATE_MS = 60 * 1000;

// Cobre a lacuna do Realtime: eventos perdidos com o canal desconectado
// (aba em segundo plano/notebook dormindo, rede caída). Chama `revalidate` ao
// voltar à aba depois de > 60 s escondida e quando a rede volta.
export function useRevalidateOnReturn(revalidate) {
  const revalidateRef = useRef(revalidate);
  useEffect(() => {
    revalidateRef.current = revalidate;
  });

  useEffect(() => {
    let hiddenAt = document.hidden ? Date.now() : null;
    function run() {
      Promise.resolve(revalidateRef.current?.()).catch(() => {});
    }
    function handleVisibility() {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > HIDDEN_REVALIDATE_MS) {
        hiddenAt = null;
        run();
      } else {
        hiddenAt = null;
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', run);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', run);
    };
  }, []);
}
