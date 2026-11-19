'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import SortIcon from './SortIcon';

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function formatSize(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Aba "Arquivos" do curso, para todos os papéis. O Canvas lista arquivos sem
// ordem de envio; aqui a ordem padrão é a cronológica do envio ao Canvas
// (`created_at`), do mais recente ao mais antigo, trocável pelo dropdown ou
// clicando nos cabeçalhos. Busca por nome. A tabela segue o mesmo padrão
// visual de AssignmentsTable (controles em .browser-controls, cabeçalhos
// ordenáveis com SortIcon, coluna de ícone, nome com link externo ao lado e
// coluna "Ações"). Racional: specs/decisions/0023-ordem-cronologica-no-curso.md.
const SORTERS = {
  name: (f) => f.display_name?.toLowerCase() ?? '',
  date: (f) => (f.created_at ? new Date(f.created_at).getTime() : 0),
  size: (f) => f.size ?? -1,
};

export default function CourseFiles({ courseId, files, baseUrl }) {
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' });
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const getValue = SORTERS[sort.key];
    const sign = sort.direction === 'asc' ? 1 : -1;
    return files
      .filter((f) => !term || f.display_name?.toLowerCase().includes(term))
      .sort((a, b) => {
        const va = getValue(a);
        const vb = getValue(b);
        if (va < vb) return -1 * sign;
        if (va > vb) return 1 * sign;
        return 0;
      });
  }, [files, sort, query]);

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: key === 'date' ? 'desc' : 'asc' };
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }

  function sortAria(key) {
    if (sort.key !== key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  if (files.length === 0) {
    return <p className="lede">Nenhum arquivo enviado neste curso ainda.</p>;
  }

  return (
    <>
      <div className="browser-controls">
        <input
          type="search"
          className="search-input"
          placeholder="Buscar arquivo por nome..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar arquivo por nome"
        />
        <select
          className="group-select"
          value={sort.key === 'date' ? sort.direction : ''}
          onChange={(e) => setSort({ key: 'date', direction: e.target.value })}
          aria-label="Ordem de envio"
        >
          {sort.key !== 'date' && (
            <option value="" disabled>
              Ordenado por coluna
            </option>
          )}
          <option value="desc">Mais recente</option>
          <option value="asc">Mais antigo</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="lede">Nenhum arquivo encontrado com essa busca.</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="status-cell">
                  <span className="sr-only">Tipo</span>
                </th>
                <th aria-sort={sortAria('name')}>
                  <button type="button" className="th-sort-btn" onClick={() => toggleSort('name')}>
                    Arquivo
                    <SortIcon direction={sort.key === 'name' ? sort.direction : null} />
                  </button>
                </th>
                <th aria-sort={sortAria('date')}>
                  <button type="button" className="th-sort-btn" onClick={() => toggleSort('date')}>
                    Enviado em
                    <SortIcon direction={sort.key === 'date' ? sort.direction : null} />
                  </button>
                </th>
                <th aria-sort={sortAria('size')}>
                  <button type="button" className="th-sort-btn" onClick={() => toggleSort('size')}>
                    Tamanho
                    <SortIcon direction={sort.key === 'size' ? sort.direction : null} />
                  </button>
                </th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((file) => {
                const fileUrl = baseUrl ? `${baseUrl}/courses/${courseId}/files/${file.id}` : null;
                return (
                  <tr key={file.id}>
                    <td className="status-cell">
                      <FileText size={16} strokeWidth={1.8} aria-hidden="true" />
                    </td>
                    <td className="course-name-cell">
                      {file.display_name}
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link-icon"
                          title="Abrir arquivo no Canvas"
                          aria-label="Abrir arquivo no Canvas"
                        >
                          <ExternalLink size={14} strokeWidth={1.8} />
                        </a>
                      )}
                    </td>
                    <td className="pending-cell">{formatDateTime(file.created_at)}</td>
                    <td className="pending-cell">{formatSize(file.size)}</td>
                    <td className="actions-cell">
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-icon"
                          title="Abrir arquivo no Canvas"
                          aria-label="Abrir arquivo no Canvas"
                        >
                          <ExternalLink size={18} strokeWidth={1.8} />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
