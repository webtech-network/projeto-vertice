'use client';

import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import Modal from './Modal';
import { useTasks } from './TasksProvider';
import { exportTasksFile, importTasksFile } from '@/lib/tasks/tasksExport';

// Local JSON backup/restore for tasks + projects — independent of the
// automatic Google Drive sync (Fase 3), for a professor who wants a plain
// file (to keep offline, move between accounts, etc). Import merges rather
// than replaces (see tasksExport.js's importTasksFile), then re-hydrates
// TasksProvider's state and nudges the Drive sync scheduler
// so the merged result reaches Drive too, same as any other local edit.
export default function TasksExportImport({ onClose }) {
  const { refreshFromLocal } = useTasks();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportMessage, setExportMessage] = useState(null);

  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importMessage, setImportMessage] = useState(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    setExportMessage(null);
    try {
      const result = await exportTasksFile();
      setExportMessage(`Arquivo exportado: ${result.tasks} tarefa(s), ${result.projects} projeto(s).`);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportFile(file);
    setImportError(null);
    setImportMessage(null);
  }

  async function handleImport() {
    if (!importFile) return;
    if (
      !window.confirm(
        'Importar vai mesclar as tarefas e projetos do arquivo com os já existentes — para cada item repetido, a versão mais recente (por data de alteração) prevalece. Continuar?',
      )
    ) {
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportMessage(null);
    try {
      const result = await importTasksFile(importFile);
      await refreshFromLocal();
      setImportMessage(`Importado: ${result.tasks} tarefa(s), ${result.projects} projeto(s) no total.`);
      setImportFile(null);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title="Exportar/Importar tarefas" onClose={onClose}>
      <div className="tasks-export-import">
        <section className="tasks-export-import-section">
          <h3>Exportar</h3>
          <p className="lede">Baixa um arquivo JSON com todas as tarefas e projetos atuais.</p>
          <button type="button" className="btn btn-secondary btn-sm" disabled={exporting} onClick={handleExport}>
            <Download size={15} strokeWidth={1.8} />
            {exporting ? 'Exportando…' : 'Baixar arquivo'}
          </button>
          {exportError && (
            <p className="alert alert-error" role="alert">
              {exportError}
            </p>
          )}
          {exportMessage && (
            <p className="alert alert-success" role="status">
              {exportMessage}
            </p>
          )}
        </section>

        <section className="tasks-export-import-section">
          <h3>Importar</h3>
          <p className="lede">Mescla tarefas e projetos de um arquivo JSON exportado anteriormente.</p>
          <div className="tasks-export-import-actions">
            <label className="btn btn-secondary btn-sm" htmlFor="tasks-import-file">
              <Upload size={15} strokeWidth={1.8} />
              Selecionar arquivo
            </label>
            <input
              id="tasks-import-file"
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelected}
              hidden
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!importFile || importing}
              onClick={handleImport}
            >
              {importing ? 'Importando…' : 'Importar'}
            </button>
          </div>
          {importFile && <p className="lede">Arquivo selecionado: {importFile.name}</p>}
          {importError && (
            <p className="alert alert-error" role="alert">
              {importError}
            </p>
          )}
          {importMessage && (
            <p className="alert alert-success" role="status">
              {importMessage}
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}
