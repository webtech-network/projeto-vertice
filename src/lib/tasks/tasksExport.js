import { listTasks, replaceAllTasks } from './tasksRepo';
import { listProjects, replaceAllProjects } from './projectsRepo';
import { listWorkspaces, createWorkspace } from '../workspaces/workspacesRepo';
import { mergeRecords } from '../recordMerge';

// Same envelope shape as the Google Drive tasks sync file (tasksDriveSync.js
// imports these same constants) — a file exported here is, in principle,
// interchangeable with the Drive file, just reached via a manual
// download/upload instead of the automatic sync.
//
// The literal `'workspace-export'` value is kept even though this module
// was renamed from workspaceExport.js — it's the `kind` every existing
// user's already-synced Drive file was written with, and changing it would
// make the first sync after this rename treat that file as unrecognized.
export const TASKS_EXPORT_KIND = 'workspace-export';
export const TASKS_EXPORT_VERSION = 1;

function buildTasksExportPayload(tasks, projects, workspaces) {
  return {
    app: 'canvastools',
    kind: TASKS_EXPORT_KIND,
    version: TASKS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tasks,
    projects,
    workspaces,
  };
}

// Downloads every local task + project + workspace (including tombstones —
// same reasoning as the Drive file: a re-import elsewhere must not
// resurrect something deleted here) as a JSON file. Purely local: doesn't
// touch Google Drive or the sync scheduler.
//
// Workspaces are exported (not just tasks/projects) because
// projects.workspace_id is a real FK in Postgres — importing a project
// whose workspace doesn't exist in the target environment fails loudly
// instead of silently dropping the link, so the target's workspaces need
// to be resolvable at import time (see importTasksFile below). The
// synthetic BASE_WORKSPACE (id 'base', never a real row) is excluded.
export async function exportTasksFile() {
  const [tasks, projects, workspaces] = await Promise.all([listTasks(), listProjects(), listWorkspaces()]);
  const realWorkspaces = workspaces.filter((w) => !w.isBase);
  const payload = buildTasksExportPayload(tasks, projects, realWorkspaces);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `canvastools-tarefas-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return {
    tasks: tasks.filter((t) => !t.deletedAt).length,
    projects: projects.filter((p) => !p.deletedAt).length,
    workspaces: realWorkspaces.filter((w) => !w.deletedAt).length,
  };
}

// Resolves each source workspace to a target workspace id, matching by
// NAME (workspace ids aren't portable across environments/databases — same
// reasoning as importLegacyIndexedDbData.js's identical name-matching
// logic for the old IndexedDB->Postgres migration). A source workspace
// with no same-named match in the target is created fresh there, so a
// project's organization survives the import instead of just being
// dropped to unassigned.
async function resolveWorkspaceIdsForImport(sourceWorkspaces) {
  const currentWorkspaces = await listWorkspaces();
  const currentIdByName = new Map(currentWorkspaces.filter((w) => !w.isBase).map((w) => [w.name, w.id]));

  const targetIdBySourceId = new Map();
  for (const sourceWorkspace of sourceWorkspaces) {
    if (sourceWorkspace.deletedAt) continue;
    let targetId = currentIdByName.get(sourceWorkspace.name);
    if (!targetId) {
      const created = await createWorkspace({ name: sourceWorkspace.name, color: sourceWorkspace.color ?? null });
      targetId = created.id;
      currentIdByName.set(sourceWorkspace.name, targetId);
    }
    targetIdBySourceId.set(sourceWorkspace.id, targetId);
  }
  return targetIdBySourceId;
}

// Merges an imported file's tasks/projects into what's already local — same
// last-write-wins-by-updatedAt reconciliation the Google Drive sync uses
// (mergeRecords, recordMerge.js) rather than a destructive replace, so
// importing an older export (or importing on a second device with its own
// unsynced edits) never silently loses newer local changes.
export async function importTasksFile(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('Arquivo inválido: não é um JSON válido.');
  }
  if (parsed.kind !== TASKS_EXPORT_KIND || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.projects)) {
    throw new Error('Arquivo inválido: não é um export de tarefas do Vértice.');
  }

  // parsed.workspaces só existe em arquivos exportados depois desta
  // correção — arquivos antigos (sem o campo) seguem importáveis, só sem
  // nenhum projeto vinculado a ambiente pra remapear.
  const sourceWorkspaces = Array.isArray(parsed.workspaces) ? parsed.workspaces : [];
  const targetWorkspaceIdBySourceId = await resolveWorkspaceIdsForImport(sourceWorkspaces);
  const remappedProjects = parsed.projects.map((p) => ({
    ...p,
    workspaceId: p.workspaceId ? (targetWorkspaceIdBySourceId.get(p.workspaceId) ?? null) : null,
  }));

  const [localTasks, localProjects] = await Promise.all([listTasks(), listProjects()]);
  const mergedTasks = mergeRecords(localTasks, parsed.tasks);
  const mergedProjects = mergeRecords(localProjects, remappedProjects);
  // Projetos primeiro: tasks.project_id tem FK pra projects(id) (Postgres,
  // ao contrário do IndexedDB de antes, não deixa inserir uma tarefa
  // apontando pra um projeto que ainda não existe na tabela).
  await replaceAllProjects(mergedProjects);
  await replaceAllTasks(mergedTasks);

  return {
    tasks: mergedTasks.filter((t) => !t.deletedAt).length,
    projects: mergedProjects.filter((p) => !p.deletedAt).length,
    workspaces: targetWorkspaceIdBySourceId.size,
  };
}
