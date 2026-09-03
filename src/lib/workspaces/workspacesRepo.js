import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

// O workspace Base continua sendo um estado puramente de UI, nunca um
// registro — agora nem existe mais uma tabela de link pra ele aparecer
// implicitamente em; "Base ativo" só significa "sem filtro" em
// WorkspaceScopeProvider.jsx, que nunca chama este módulo pra resolver isso.
export const BASE_WORKSPACE_ID = 'base';
export const BASE_WORKSPACE = {
  id: BASE_WORKSPACE_ID,
  name: 'Base',
  color: null,
  isBase: true,
  editable: false,
};

function assertNotBase(id) {
  if (id === BASE_WORKSPACE_ID) {
    throw new Error('O workspace Base não pode ser editado, excluído, nem ter itens associados explicitamente — ele já inclui todos os itens por padrão.');
  }
}

function toApp(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    // Epoch-ms, não string ISO — ver o mesmo comentário em tasksRepo.js.
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function listWorkspaces() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return [BASE_WORKSPACE, ...data.map(toApp)];
}

export async function getWorkspace(id) {
  if (id === BASE_WORKSPACE_ID) return BASE_WORKSPACE;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from('workspaces').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toApp(data) : null;
}

export async function createWorkspace({ name, color = null }) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from('workspaces').insert({ name, color }).select().single();
  if (error) throw error;
  return toApp(data);
}

export async function updateWorkspace(id, patch) {
  assertNotBase(id);
  const supabase = createSupabaseBrowserClient();
  const row = {};
  if ('name' in patch) row.name = patch.name;
  if ('color' in patch) row.color = patch.color;
  const { data, error } = await supabase.from('workspaces').update(row).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return data ? toApp(data) : null;
}

// Soft delete — as próprias policies de RLS não liberam DELETE físico (ver
// supabase/volumes/db/init/05_rls.sql). Projetos apontando pra este
// workspace ficam com workspace_id ainda preenchido (mesmo princípio de
// "link órfão não incomoda" do modelo antigo) — listWorkspaces() já exclui
// o workspace deletado, e listAllLinks() abaixo ignora projetos cujo
// workspace não existe mais na leitura seguinte.
export async function deleteWorkspace(id) {
  return updateWorkspace(id, { deletedAt: Date.now() });
}

// =====================================================================
// Compatibilidade com a API "de links" que WorkspaceScopeProvider.jsx (e,
// através dele, os componentes de UI — WorkspaceEditModal,
// ResourceWorkspacesModal, ProjectFormModal etc.) já consome — sem isso,
// seria necessário reescrever todos eles. A diferença real do modelo N:N
// solto de antes pro 1:N direto de agora fica escondida aqui dentro:
// projetos guardam o workspace_id na própria linha (projects.workspace_id);
// cursos do Canvas não têm onde guardar isso (não são uma linha em
// `projects`), então usam a tabela dedicada `course_workspace_links` — em
// ambos os casos, no máximo um workspace por item, nunca N:N.
// =====================================================================

function linkId(workspaceId, resourceType, resourceId) {
  return `${workspaceId}:${resourceType}:${resourceId}`;
}

export async function listAllLinks() {
  const supabase = createSupabaseBrowserClient();
  const [{ data: projectRows, error: projectError }, { data: courseRows, error: courseError }] = await Promise.all([
    supabase.from('projects').select('id, workspace_id').not('workspace_id', 'is', null).is('deleted_at', null),
    supabase.from('course_workspace_links').select('course_id, workspace_id'),
  ]);
  if (projectError) throw projectError;
  if (courseError) throw courseError;

  const projectLinks = projectRows.map((p) => ({
    id: linkId(p.workspace_id, 'project', p.id),
    workspaceId: p.workspace_id,
    resourceType: 'project',
    resourceId: p.id,
    deletedAt: null,
  }));
  const courseLinks = courseRows.map((c) => ({
    id: linkId(c.workspace_id, 'course', c.course_id),
    workspaceId: c.workspace_id,
    resourceType: 'course',
    resourceId: c.course_id,
    deletedAt: null,
  }));
  return [...projectLinks, ...courseLinks];
}

export async function setResourceWorkspaces(resourceType, resourceId, workspaceIds) {
  const supabase = createSupabaseBrowserClient();
  const workspaceId = workspaceIds.filter((w) => w !== BASE_WORKSPACE_ID)[0] ?? null;

  if (resourceType === 'project') {
    const { error } = await supabase.from('projects').update({ workspace_id: workspaceId }).eq('id', resourceId);
    if (error) throw error;
    return workspaceId ? 1 : 0;
  }

  if (resourceType === 'course') {
    const courseId = String(resourceId);
    if (workspaceId) {
      const { error } = await supabase
        .from('course_workspace_links')
        .upsert({ course_id: courseId, workspace_id: workspaceId }, { onConflict: 'user_id,course_id' });
      if (error) throw error;
      return 1;
    }
    const { error } = await supabase.from('course_workspace_links').delete().eq('course_id', courseId);
    if (error) throw error;
    return 0;
  }

  console.warn(`setResourceWorkspaces: resourceType "${resourceType}" não é suportado.`);
  return 0;
}

// O espelho de setResourceWorkspaces acima — resolve o conjunto de
// projetos/cursos de um workspace de uma vez (backend de
// WorkspaceEditModal.jsx, que gerencia a associação pelo lado do
// workspace).
export async function setWorkspaceResources(workspaceId, resourceType, resourceIds) {
  assertNotBase(workspaceId);
  const supabase = createSupabaseBrowserClient();
  const target = new Set(resourceIds.map(String));

  if (resourceType === 'project') {
    const { data: current, error: readError } = await supabase
      .from('projects')
      .select('id')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);
    if (readError) throw readError;

    const currentIds = new Set(current.map((p) => p.id));
    const toDetach = [...currentIds].filter((id) => !target.has(id));
    const toAttach = [...target].filter((id) => !currentIds.has(id));

    if (toDetach.length > 0) {
      const { error } = await supabase.from('projects').update({ workspace_id: null }).in('id', toDetach);
      if (error) throw error;
    }
    if (toAttach.length > 0) {
      const { error } = await supabase.from('projects').update({ workspace_id: workspaceId }).in('id', toAttach);
      if (error) throw error;
    }
    return target.size;
  }

  if (resourceType === 'course') {
    const { data: current, error: readError } = await supabase
      .from('course_workspace_links')
      .select('course_id')
      .eq('workspace_id', workspaceId);
    if (readError) throw readError;

    const currentIds = new Set(current.map((c) => c.course_id));
    const toDetach = [...currentIds].filter((id) => !target.has(id));
    const toAttach = [...target].filter((id) => !currentIds.has(id));

    if (toDetach.length > 0) {
      const { error } = await supabase.from('course_workspace_links').delete().eq('workspace_id', workspaceId).in('course_id', toDetach);
      if (error) throw error;
    }
    if (toAttach.length > 0) {
      const { error } = await supabase
        .from('course_workspace_links')
        .upsert(
          toAttach.map((courseId) => ({ course_id: courseId, workspace_id: workspaceId })),
          { onConflict: 'user_id,course_id' },
        );
      if (error) throw error;
    }
    return target.size;
  }

  console.warn(`setWorkspaceResources: resourceType "${resourceType}" não é suportado.`);
  return 0;
}
