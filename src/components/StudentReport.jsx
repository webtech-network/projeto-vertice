'use client';

import { useMemo, useState } from 'react';
import { Download, Mail, BarChart3 } from 'lucide-react';
import { ENROLLMENT_STATE_LABELS } from '@/lib/studentReport';
import { studentGradesUrl } from '@/lib/canvasLinks';
import StudentMessageModal from './StudentMessageModal';
import SortIcon from './SortIcon';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function formatActivityTime(seconds) {
  if (seconds == null) return '—';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}min` : `${hours}h`;
}

function formatGrade(score, grade) {
  if (grade != null) return grade;
  if (score != null) return score;
  return '—';
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

const CSV_HEADERS = [
  'Nome',
  'E-mail/Login',
  'Status da matrícula',
  'Última atividade',
  'Tempo de atividade',
  'Nota atual',
  'Nota final',
];

function rowsToCsv(rows) {
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.contact,
        ENROLLMENT_STATE_LABELS[row.enrollmentState] || '—',
        formatDate(row.lastActivityAt),
        formatActivityTime(row.totalActivityTime),
        formatGrade(row.currentScore, row.currentGrade),
        formatGrade(row.finalScore, row.finalGrade),
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return lines.join('\n');
}

function downloadCsv(rows) {
  const csv = rowsToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alunos-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Notas do curso (grades) dependem de permissão da conta Canvas para o
// professor consultar — quando a conta não permite, `enrollment.grades`
// simplesmente não vem em nenhum aluno, então o relatório avisa em vez de
// mostrar duas colunas cheias de "—" sem explicação.
function allGradesMissing(rows) {
  return rows.every((r) => r.currentScore == null && r.currentGrade == null && r.finalScore == null && r.finalGrade == null);
}

// Same shape as CourseBrowser.jsx's own SORTERS/toggleSort/sortAria trio —
// a missing value sorts as the lowest possible one (-1 or '') so it lands
// first ascending / last descending. Grade columns sort by the numeric
// score only (currentGrade/finalGrade can be a non-numeric letter grade
// depending on the course's grading scheme, so score is the one reliably
// sortable field between the two formatGrade() already falls back through).
const SORTERS = {
  name: (r) => r.name?.toLowerCase() ?? '',
  contact: (r) => r.contact?.toLowerCase() ?? '',
  enrollmentState: (r) => ENROLLMENT_STATE_LABELS[r.enrollmentState]?.toLowerCase() ?? '',
  lastActivity: (r) => (r.lastActivityAt ? new Date(r.lastActivityAt).getTime() : -1),
  activityTime: (r) => r.totalActivityTime ?? -1,
  currentScore: (r) => r.currentScore ?? -1,
  finalScore: (r) => r.finalScore ?? -1,
};

export default function StudentReport({ rows, courseId, baseUrl, integrations = [] }) {
  const [query, setQuery] = useState('');
  const [messageStudent, setMessageStudent] = useState(null);
  const [sort, setSort] = useState({ key: null, direction: 'asc' });
  // Defaults to hiding inactive students — matches this page's own stated
  // scope ("Listagem dos alunos ativos do curso") — but stays a toggle
  // rather than a hard filter, since a professor might want to see who was
  // deactivated. See listCourseStudents() in canvasClient.js for why the
  // 'inactive' state is now fetched at all instead of being excluded
  // server-side.
  const [hideInactive, setHideInactive] = useState(true);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (hideInactive && row.enrollmentState === 'inactive') return false;
      if (!term) return true;
      return row.name?.toLowerCase().includes(term) || row.contact?.toLowerCase().includes(term);
    });
  }, [rows, query, hideInactive]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const getValue = SORTERS[sort.key];
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });
  }, [filtered, sort]);

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }

  function sortAria(key) {
    if (sort.key !== key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  const gradesUnavailable = useMemo(() => allGradesMissing(rows), [rows]);

  if (rows.length === 0) {
    return <p className="lede">Nenhum aluno ativo encontrado neste curso.</p>;
  }

  return (
    <>
      <div className="browser-controls">
        <input
          type="search"
          className="search-input"
          placeholder="Pesquisar por nome ou e-mail..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Pesquisar alunos"
        />
        <label className="checkbox-filter">
          <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} />
          Ocultar alunos inativos
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => downloadCsv(filtered)}>
          <Download size={16} strokeWidth={1.8} aria-hidden="true" />
          Exportar CSV
        </button>
      </div>

      {gradesUnavailable && (
        <p className="alert alert-warning" role="alert">
          As notas não estão disponíveis para consulta via API nesta conta Canvas — as colunas de nota ficarão em
          branco para todos os alunos.
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="lede">
          {hideInactive && query.trim() === ''
            ? 'Nenhum aluno ativo encontrado — desmarque "Ocultar alunos inativos" para ver todos.'
            : 'Nenhum aluno encontrado com essa pesquisa.'}
        </p>
      ) : (
        <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th aria-sort={sortAria('name')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('name')}>
                  Nome
                  <SortIcon direction={sort.key === 'name' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('contact')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('contact')}>
                  E-mail/Login
                  <SortIcon direction={sort.key === 'contact' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('enrollmentState')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('enrollmentState')}>
                  Status
                  <SortIcon direction={sort.key === 'enrollmentState' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('lastActivity')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('lastActivity')}>
                  Última atividade
                  <SortIcon direction={sort.key === 'lastActivity' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('activityTime')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('activityTime')}>
                  Tempo de atividade
                  <SortIcon direction={sort.key === 'activityTime' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('currentScore')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('currentScore')}>
                  Nota atual
                  <SortIcon direction={sort.key === 'currentScore' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('finalScore')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('finalScore')}>
                  Nota final
                  <SortIcon direction={sort.key === 'finalScore' ? sort.direction : null} />
                </button>
              </th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id}>
                <td className="course-name-cell">{row.name}</td>
                <td title={row.contactIsLogin ? 'E-mail não disponível — exibindo login do Canvas' : undefined}>
                  {row.contact}
                </td>
                <td>{ENROLLMENT_STATE_LABELS[row.enrollmentState] || '—'}</td>
                <td>{formatDate(row.lastActivityAt)}</td>
                <td>{formatActivityTime(row.totalActivityTime)}</td>
                <td>{formatGrade(row.currentScore, row.currentGrade)}</td>
                <td>{formatGrade(row.finalScore, row.finalGrade)}</td>
                <td className="actions-cell">
                  <button
                    type="button"
                    className="btn btn-primary btn-icon"
                    title="Enviar mensagem com IA"
                    aria-label={`Enviar mensagem com IA para ${row.name}`}
                    onClick={() => setMessageStudent(row)}
                  >
                    <Mail size={18} strokeWidth={1.8} />
                  </button>
                  <a
                    href={studentGradesUrl(baseUrl, courseId, row.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-icon"
                    title="Ver notas no Canvas"
                    aria-label={`Ver notas de ${row.name} no Canvas`}
                  >
                    <BarChart3 size={18} strokeWidth={1.8} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {messageStudent && (
        <StudentMessageModal
          student={messageStudent}
          courseId={courseId}
          integrations={integrations}
          onClose={() => setMessageStudent(null)}
        />
      )}
    </>
  );
}
