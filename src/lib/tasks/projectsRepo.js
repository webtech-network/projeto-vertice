import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';
import { listTasks, updateTask } from './tasksRepo';

// canvasReference é um objeto ({ courseId }) no resto do app — a coluna no
// Postgres (canvas_course_id, ver plano — stopgap até external_references
// existir na Fase 2) só guarda o id em si. workspaceId é campo novo, sem
// equivalente no modelo antigo (a associação vivia numa link table à parte).
// Exportado — reaproveitado por TasksProvider.jsx pra mapear linhas cruas
// que chegam via Realtime (useRealtimeTable), sem duplicar este mapeamento.
export function toApp(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    canvasReference: row.canvas_course_id ? { courseId: row.canvas_course_id } : null,
    color: row.color,
    workspaceId: row.workspace_id,
    // Epoch-ms, não string ISO — ver o mesmo comentário em tasksRepo.js.
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function fromAppPatch(patch) {
  const row = {};
  if ('name' in patch) row.name = patch.name;
  if ('type' in patch) row.type = patch.type;
  if ('canvasReference' in patch) row.canvas_course_id = patch.canvasReference?.courseId ?? null;
  if ('color' in patch) row.color = patch.color;
  if ('workspaceId' in patch) row.workspace_id = patch.workspaceId;
  if ('deletedAt' in patch) row.deleted_at = patch.deletedAt ? new Date(patch.deletedAt).toISOString() : null;
  return row;
}

export async function listProjects() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(toApp);
}

export async function getProject(id) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return toApp(data);
}

export async function createProject({ name, type, canvasReference = null, color = null, workspaceId = null }) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name,
      type,
      canvas_course_id: canvasReference?.courseId ?? null,
      color,
      workspace_id: workspaceId,
    })
    .select()
    .single();
  if (error) throw error;
  return toApp(data);
}

export async function updateProject(id, patch) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('projects')
    .update(fromAppPatch(patch))
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return toApp(data);
}

// Upsert por id, não delete+insert — ver o comentário completo em
// tasksRepo.js's replaceAllTasks (RLS de propósito não libera DELETE
// físico pra authenticated).
export async function replaceAllProjects(projectsArray) {
  if (projectsArray.length === 0) return 0;
  const supabase = createSupabaseBrowserClient();

  const rows = projectsArray.map((p) => ({
    id: typeof p.id === 'string' && p.id ? p.id : crypto.randomUUID(),
    name: p.name || '',
    type: p.type === 'canvas-course' ? 'canvas-course' : 'personal',
    canvas_course_id: p.canvasReference?.courseId ?? null,
    color: p.color ?? null,
    workspace_id: p.workspaceId ?? null,
    deleted_at: p.deletedAt ? new Date(p.deletedAt).toISOString() : null,
  }));
  const { error: upsertError } = await supabase.from('projects').upsert(rows, { onConflict: 'id' });
  if (upsertError) throw upsertError;
  return projectsArray.length;
}

// Deleting a project never cascades into deleting its tasks — that would
// silently destroy a professor's work over what's just an organizational
// grouping. Affected tasks are kept, only detached (projectId: null).
// Soft delete (tombstone) — see tasksRepo.js's deleteTask for why.
export async function deleteProject(id) {
  await updateProject(id, { deletedAt: Date.now() });
  const tasks = await listTasks();
  const affected = tasks.filter((t) => t.projectId === id && !t.deletedAt);
  await Promise.all(affected.map((t) => updateTask(t.id, { projectId: null })));
  return affected.map((t) => t.id);
}
