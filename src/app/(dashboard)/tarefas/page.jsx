import {
  Filter,
  PanelLeftClose,
  Rows3,
  Columns3,
  Grid2x2,
  Table2,
  Layers,
  FolderKanban,
  FileJson,
  Settings,
  Flag,
  Zap,
} from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { TasksProvider } from '@/components/TasksProvider';
import TasksView from '@/components/TasksView';
import InfoHint from '@/components/InfoHint';

// No Canvas data fetched server-side — projects/tasks live entirely in the
// browser's IndexedDB, and Canvas course/assignment/student lookups for the
// project/task pickers are client-driven through the existing cached
// /api/canvas/courses route (same pattern as courses/page.jsx not blocking
// navigation on a Canvas round-trip).
export default async function TarefasPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  return (
    <main className="page page-tarefas">
      <div className="page-title-row">
        <h1>Tarefas</h1>
        <InfoHint label="Sobre o Painel de Tarefas">
          <p>
            Organize suas tarefas pessoais em um quadro Kanban (por status) ou na matriz de Eisenhower (por
            importância x urgência), agrupadas em projetos opcionais.
          </p>
          <p>
            Adicione uma tarefa pelo campo no topo, arraste os cards entre colunas/quadrantes e clique em um card para
            ver ou editar seus detalhes. A legenda de status e prioridade fica logo abaixo do quadro.
          </p>
          <h4>Ícones e botões</h4>
          <ul className="icon-legend">
            <li>
              <Filter size={14} strokeWidth={1.8} aria-hidden="true" /> Filtrar tarefas
            </li>
            <li>
              <PanelLeftClose size={14} strokeWidth={1.8} aria-hidden="true" /> Mostrar/ocultar Backlog e Bloqueadas
            </li>
            <li>
              <Rows3 size={14} strokeWidth={1.8} aria-hidden="true" /> Densidade dos cards
            </li>
            <li>
              <Columns3 size={14} strokeWidth={1.8} aria-hidden="true" /> Visão Kanban
            </li>
            <li>
              <Grid2x2 size={14} strokeWidth={1.8} aria-hidden="true" /> Visão Matriz de Eisenhower
            </li>
            <li>
              <Table2 size={14} strokeWidth={1.8} aria-hidden="true" /> Visão em Tabela
            </li>
            <li>
              <Layers size={14} strokeWidth={1.8} aria-hidden="true" /> Agrupar por projeto
            </li>
            <li>
              <FolderKanban size={14} strokeWidth={1.8} aria-hidden="true" /> Projetos
            </li>
            <li>
              <FileJson size={14} strokeWidth={1.8} aria-hidden="true" /> Exportar/Importar tarefas
            </li>
            <li>
              <Settings size={14} strokeWidth={1.8} aria-hidden="true" /> Preferências de Tarefas
            </li>
            <li>
              <Flag size={14} strokeWidth={1.8} aria-hidden="true" /> Importante
            </li>
            <li>
              <Zap size={14} strokeWidth={1.8} aria-hidden="true" /> Urgente
            </li>
          </ul>
        </InfoHint>
      </div>

      <TasksProvider>
        <TasksView />
      </TasksProvider>
    </main>
  );
}
