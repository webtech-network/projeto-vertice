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

// Sem uso direto de UI hoje — mantidas só porque workspacesDriveSync.js
// importa esses dois nomes no topo do arquivo, e esse módulo é carregado
// (ainda que não mais acionado) por SyncStatusIndicator.jsx no Topbar;
// remover os exports quebraria essa importação e derrubaria o build
// inteiro. Implementadas de verdade (não como stub) para não corromper
// nada no raro caso de ainda serem chamadas.
// Upsert por id, não delete+insert — mesmo motivo de tasksRepo.js's
// replaceAllTasks (RLS de propósito não libera DELETE físico).
export async function replaceAllWorkspaces(workspacesArray) {
  const supabase = createSupabaseBrowserClient();

  const rows = workspacesArray
    .filter((w) => w.id !== BASE_WORKSPACE_ID)
    .map((w) => ({
      id: typeof w.id === 'string' && w.id ? w.id : crypto.randomUUID(),
      name: w.name || '',
      color: w.color ?? null,
      deleted_at: w.deletedAt ? new Date(w.deletedAt).toISOString() : null,
    }));
  if (rows.length === 0) return 0;
  const { error: upsertError } = await supabase.from('workspaces').upsert(rows, { onConflict: 'id' });
  if (upsertError) throw upsertError;
  return workspacesArray.length;
}

export async function replaceAllLinks(linksArray) {
  const supabase = createSupabaseBrowserClient();
  const desiredByProject = new Map(
    linksArray.filter((l) => l.resourceType === 'project' && !l.deletedAt).map((l) => [String(l.resourceId), l.workspaceId]),
  );

  const { data: allProjects, error } = await supabase.from('projects').select('id, workspace_id').is('deleted_at', null);
  if (error) throw error;

  await Promise.all(
    allProjects
      .filter((p) => (desiredByProject.get(p.id) ?? null) !== p.workspace_id)
      .map((p) => supabase.from('projects').update({ workspace_id: desiredByProject.get(p.id) ?? null }).eq('id', p.id)),
  );
  return linksArray.length;
}

// =====================================================================
// Compatibilidade com a API "de links" que WorkspaceScopeProvider.jsx (e,
// através dele, 11 componentes de UI — WorkspaceResourcesModal,
// ResourceWorkspacesModal, ProjectFormModal etc.) já consome — sem isso,
// seria necessário reescrever todos eles. A diferença real do modelo N:N
// solto de antes pro 1:N direto de agora (projects.workspace_id) fica
// escondida aqui dentro.
//
// resourceType 'course' é sempre um no-op: cursos do Canvas não têm onde
// gravar workspace_id nesta fase (dependeria de external_references, Fase
// 2) — ver "curso vinculado a workspace sem projeto" no plano. Lacuna
// conhecida, não bug; hoje as telas de curso já ficam inacessíveis de
// qualquer forma (gating de Canvas também é Fase 2), então não há UI
// alcançável que dependa disto ainda.
// =====================================================================

function linkId(workspaceId, resourceType, resourceId) {
  return `${workspaceId}:${resourceType}:${resourceId}`;
}

export async function listAllLinks() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id, workspace_id')
    .not('workspace_id', 'is', null)
    .is('deleted_at', null);
  if (error) throw error;
  return data.map((p) => ({
    id: linkId(p.workspace_id, 'project', p.id),
    workspaceId: p.workspace_id,
    resourceType: 'project',
    resourceId: p.id,
    deletedAt: null,
  }));
}

export async function setResourceWorkspaces(resourceType, resourceId, workspaceIds) {
  if (resourceType !== 'project') {
    console.warn(`setResourceWorkspaces: resourceType "${resourceType}" não é suportado nesta fase (só "project").`);
    return 0;
  }
  const workspaceId = workspaceIds.filter((w) => w !== BASE_WORKSPACE_ID)[0] ?? null;
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from('projects').update({ workspace_id: workspaceId }).eq('id', resourceId);
  if (error) throw error;
  return workspaceId ? 1 : 0;
}

// O espelho de setResourceWorkspaces acima — resolve o conjunto de projetos
// de um workspace de uma vez (backend de WorkspaceResourcesModal.jsx, que
// gerencia a associação pelo lado do workspace). Só resourceType 'project'
// é suportado, pelo mesmo motivo.
export async function setWorkspaceResources(workspaceId, resourceType, resourceIds) {
  assertNotBase(workspaceId);
  if (resourceType !== 'project') {
    console.warn(`setWorkspaceResources: resourceType "${resourceType}" não é suportado nesta fase (só "project").`);
    return 0;
  }
  const supabase = createSupabaseBrowserClient();
  const target = new Set(resourceIds.map(String));

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
