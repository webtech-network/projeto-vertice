'use client';

import { useWorkspaceScope } from './WorkspaceScopeProvider';

// Checkbox list sobre todo workspace real (Base excluído — é implícito, não
// dá pra marcar, todo item já pertence a ele). Usado inline por
// ProjectFormModal.jsx e dentro de ResourceWorkspacesModal.jsx.
//
// Marca no máximo um por vez (comportamento de rádio usando checkboxes) —
// desde a Fase 1, um projeto pertence a um único ambiente
// (projects.workspace_id, 1:N direto), não mais vários (N:N solto de
// antes). O array `selectedIds` continua tendo 0 ou 1 elemento, não mais —
// mantém o mesmo contrato de props pros dois consumidores.
export default function WorkspaceMultiSelect({ selectedIds, onChange }) {
  const { workspaces } = useWorkspaceScope();
  const assignable = workspaces.filter((w) => !w.isBase);

  if (assignable.length === 0) {
    return <p className="field-note">Nenhum workspace criado ainda — todo item pertence ao workspace Base por padrão.</p>;
  }

  function toggle(id) {
    onChange(selectedIds.includes(id) ? [] : [id]);
  }

  return (
    <ul className="workspace-multiselect-list">
      {assignable.map((workspace) => (
        <li key={workspace.id} className="workspace-multiselect-row">
          <label className="task-detail-checkbox">
            <input type="checkbox" checked={selectedIds.includes(workspace.id)} onChange={() => toggle(workspace.id)} />
            <span
              className="tasks-projects-color-dot"
              style={{ backgroundColor: workspace.color || 'transparent' }}
              aria-hidden="true"
            />
            {workspace.name}
          </label>
        </li>
      ))}
    </ul>
  );
}
