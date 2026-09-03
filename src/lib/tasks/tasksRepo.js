import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

// Backlog and Block lead the board on purpose — they're the two "not
// actively being worked" stages (not yet planned, and blocked/stuck), kept
// together up front so the collapse toggle in TasksView.jsx has a
// single contiguous pair of columns to fold away (see .kanban-board--
// stages-collapsed in globals.css, which assumes these are the first two).
export const STATUSES = ['BACKLOG', 'BLOCK', 'TODO', 'DOING', 'DONE'];

// Mapeamento de campo camelCase (app) <-> snake_case (Postgres) — preserva
// exatamente o shape que TasksProvider.jsx e o resto do app já esperam
// (o mesmo formato que vinha do IndexedDB), então esses consumidores não
// precisam mudar uma linha.
function toApp(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: { urgent: row.urgent, important: row.important },
    priorityRank: row.priority_rank,
    projectId: row.project_id,
    tags: row.tags || [],
    dueDate: row.due_date,
    canvasReferences: row.canvas_references,
    // Epoch-ms, não string ISO — recordMerge.js's mergeRecords compara
    // updatedAt com `>` puro (assume número); uma string quebraria isso
    // silenciosamente (comparação vira NaN > NaN, sempre falsa).
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function fromAppPatch(patch) {
  const row = {};
  if ('title' in patch) row.title = patch.title;
  if ('description' in patch) row.description = patch.description;
  if ('status' in patch) row.status = patch.status;
  if ('priority' in patch) {
    row.urgent = Boolean(patch.priority?.urgent);
    row.important = Boolean(patch.priority?.important);
  }
  if ('priorityRank' in patch) row.priority_rank = patch.priorityRank;
  if ('projectId' in patch) row.project_id = patch.projectId;
  if ('tags' in patch) row.tags = patch.tags;
  if ('dueDate' in patch) row.due_date = patch.dueDate;
  if ('canvasReferences' in patch) row.canvas_references = patch.canvasReferences;
  if ('deletedAt' in patch) row.deleted_at = patch.deletedAt ? new Date(patch.deletedAt).toISOString() : null;
  return row;
}

export async function listTasks() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(toApp);
}

export async function getTask(id) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return toApp(data);
}

// Quick-create (spec section 6): only a title is required. Every other
// field starts at a sensible empty default and is filled in later via
// updateTask from TaskDetailModal.jsx.
export async function createTask({ title, projectId = null }) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('tasks')
    .insert({ title, project_id: projectId })
    .select()
    .single();
  if (error) throw error;
  return toApp(data);
}

export async function updateTask(id, patch) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('tasks')
    .update(fromAppPatch(patch))
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return toApp(data);
}

// Soft delete — tombstone (deletedAt) em vez de DELETE físico, mesmo padrão
// de antes (a policy de RLS nem libera DELETE — ver 05_rls.sql).
export async function deleteTask(id) {
  return updateTask(id, { deletedAt: Date.now() });
}

export async function setTaskStatus(id, status) {
  return updateTask(id, { status });
}

export async function setTaskPriority(id, priority) {
  return updateTask(id, { priority });
}

// Drag-to-reorder within a single Kanban column / Eisenhower quadrant (see
// KanbanBoard.jsx's and EisenhowerMatrix.jsx's handleDragEnd) bumps
// priorityRank by exactly one level per drop — not a full re-rank of every
// task in between — so this is a plain single-field patch, same shape as
// setTaskStatus/setTaskPriority above.
export async function setTaskPriorityRank(id, priorityRank) {
  return updateTask(id, { priorityRank });
}

// Usado por tasksExport.js's importTasksFile e pela importação única do
// IndexedDB legado (importLegacyIndexedDb.js) — o merge (mergeRecords) já
// aconteceu antes de chegar aqui, então isto só precisa persistir o
// resultado. Upsert por id, não delete+insert: as policies de RLS
// (05_rls.sql) de propósito não liberam DELETE físico pra authenticated
// (só soft-delete via UPDATE), então um delete().insert() aqui falharia —
// o DELETE seria silenciosamente bloqueado (0 linhas) e o INSERT seguinte
// bateria de frente com os ids que "deveriam" ter sumido. upsert() não
// precisa do DELETE pra nada: o array já é o resultado final completo
// (incluindo tombstones deletedAt), então upsert por id já produz o mesmo
// estado final que delete+insert produziria.
export async function replaceAllTasks(tasksArray) {
  if (tasksArray.length === 0) return 0;
  const supabase = createSupabaseBrowserClient();

  const rows = tasksArray.map((t) => ({
    id: typeof t.id === 'string' && t.id ? t.id : crypto.randomUUID(),
    title: t.title || '',
    description: t.description || '',
    status: STATUSES.includes(t.status) ? t.status : 'BACKLOG',
    urgent: Boolean(t.priority?.urgent),
    important: Boolean(t.priority?.important),
    priority_rank: Number.isInteger(t.priorityRank) ? Math.min(9, Math.max(0, t.priorityRank)) : 3,
    project_id: t.projectId ?? null,
    tags: Array.isArray(t.tags) ? t.tags : [],
    due_date: t.dueDate ?? null,
    canvas_references: t.canvasReferences ?? null,
    deleted_at: t.deletedAt ? new Date(t.deletedAt).toISOString() : null,
  }));
  const { error: upsertError } = await supabase.from('tasks').upsert(rows, { onConflict: 'id' });
  if (upsertError) throw upsertError;
  return tasksArray.length;
}

export async function listAllTags() {
  const tasks = await listTasks();
  const tags = new Set();
  for (const task of tasks) {
    if (task.deletedAt) continue;
    for (const tag of task.tags || []) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}
