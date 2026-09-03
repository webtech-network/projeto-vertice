import { dbGetAll, STORE_TASKS, STORE_PROJECTS, STORE_WORKSPACES, STORE_WORKSPACE_LINKS } from '@/lib/indexedDb';
import { listWorkspaces } from '@/lib/workspaces/workspacesRepo';
import { listTasks, replaceAllTasks } from '@/lib/tasks/tasksRepo';
import { listProjects, replaceAllProjects } from '@/lib/tasks/projectsRepo';
import { mergeRecords } from '@/lib/recordMerge';

/**
 * Importação única, ponte-Fase-1: os dados de tasks/projects que viviam no
 * IndexedDB do navegador (de antes desta sessão migrar tasksRepo.js/
 * projectsRepo.js/workspacesRepo.js pra Postgres) nunca foram apagados —
 * só pararam de ser lidos pelo app. Isto lê o que sobrou de lá direto (via
 * dbGetAll, não os repos — esses agora são Postgres) e mescla com o que já
 * está no Postgres, reaproveitando a mesma lógica de merge (last-write-wins
 * por updatedAt) que tasksExport.js's importTasksFile já usa pro import
 * manual de arquivo — só a origem dos dados "remotos" é diferente (IndexedDB
 * em vez de um arquivo JSON escolhido pelo usuário).
 *
 * IDs são preservados (não regenerados) — task.projectId de uma tarefa
 * antiga continua apontando pro mesmo id de projeto depois da importação,
 * sem precisar de nenhum remapeamento.
 *
 * O vínculo workspace<->project do modelo antigo (N:N via
 * STORE_WORKSPACE_LINKS) é resolvido para o novo projects.workspace_id
 * (1:N) por NOME do workspace — não por id, já que os workspaces atuais no
 * Postgres podem ter sido recriados manualmente com ids diferentes dos que
 * existiam no IndexedDB. Um projeto que estava em mais de um workspace
 * antes fica só no primeiro encontrado (mesma regra de "no máximo um" do
 * novo modelo); um projeto cujo workspace não tem par pelo nome no Postgres
 * fica sem workspace (null), não quebra a importação.
 *
 * Chame via `window.importLegacyIndexedDbData()` no console do navegador,
 * em qualquer página logada — exposta em TasksProvider.jsx só enquanto essa
 * importação ainda não rodou (ver comentário lá).
 */
export async function importLegacyIndexedDbData() {
  const [oldTasks, oldProjects, oldWorkspaces, oldLinks] = await Promise.all([
    dbGetAll(STORE_TASKS),
    dbGetAll(STORE_PROJECTS),
    dbGetAll(STORE_WORKSPACES),
    dbGetAll(STORE_WORKSPACE_LINKS),
  ]);

  const oldWorkspaceNameById = new Map(oldWorkspaces.map((w) => [w.id, w.name]));
  const currentWorkspaces = await listWorkspaces();
  const currentWorkspaceIdByName = new Map(currentWorkspaces.filter((w) => !w.isBase).map((w) => [w.name, w.id]));

  const workspaceIdForProject = new Map();
  for (const link of oldLinks) {
    if (link.deletedAt || link.resourceType !== 'project') continue;
    if (workspaceIdForProject.has(link.resourceId)) continue; // já resolvido — mantém só o primeiro
    const oldName = oldWorkspaceNameById.get(link.workspaceId);
    const newId = oldName ? currentWorkspaceIdByName.get(oldName) : null;
    if (newId) workspaceIdForProject.set(link.resourceId, newId);
  }

  const legacyProjects = oldProjects.map((p) => ({
    ...p,
    workspaceId: workspaceIdForProject.get(p.id) ?? null,
  }));

  const [currentTasks, currentProjects] = await Promise.all([listTasks(), listProjects()]);
  const mergedProjects = mergeRecords(currentProjects, legacyProjects);
  const mergedTasks = mergeRecords(currentTasks, oldTasks);

  await replaceAllProjects(mergedProjects);
  await replaceAllTasks(mergedTasks);

  return {
    tarefasAntigasEncontradas: oldTasks.filter((t) => !t.deletedAt).length,
    projetosAntigosEncontrados: oldProjects.filter((p) => !p.deletedAt).length,
    projetosVinculadosAUmAmbiente: workspaceIdForProject.size,
    totalTarefasAposImportacao: mergedTasks.filter((t) => !t.deletedAt).length,
    totalProjetosAposImportacao: mergedProjects.filter((p) => !p.deletedAt).length,
  };
}
