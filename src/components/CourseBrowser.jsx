'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Mail,
  Star,
  Megaphone,
  ClipboardCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Maximize2,
  CircleCheckBig,
  CircleDashed,
  List,
  Layers,
  BookOpen,
} from 'lucide-react';
import StatusIcon from './StatusIcon';
import SortIcon from './SortIcon';
import CourseWorkspaceTabs from './CourseWorkspaceTabs';
import ResourceWorkspacesModal from './ResourceWorkspacesModal';
import { useWorkspaceScope } from './WorkspaceScopeProvider';
import { BASE_WORKSPACE_ID } from '@/lib/workspaces/workspacesRepo';
import { isPublished } from '@/lib/dashboard';
import { canvasKeys, cacheStatus, useCoursesQuery } from '@/lib/query/canvasQueries';
import { readCourseBrowserState, writeCourseBrowserState } from '@/lib/courseBrowserState';

function formatDateTime(timestamp) {
  if (!timestamp) return null;
  try {
    return new Date(timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return null;
  }
}

function toStatus(workflowState) {
  if (workflowState === 'available') return 'published';
  if (workflowState === 'completed') return 'completed';
  return 'unpublished';
}

const STATUS_ORDER = { published: 0, unpublished: 1, completed: 2 };

const SORTERS = {
  favorite: (course) => (course.is_favorite ? 0 : 1),
  name: (course) => course.name?.toLowerCase() ?? '',
  pending: (course) => course.needs_grading_count ?? 0,
  status: (course) => STATUS_ORDER[toStatus(course.workflow_state)] ?? 99,
  messages: (course) => course.message_count ?? -1,
};

const STATUS_FILTERS = [
  { key: 'published', label: 'Publicados', Icon: CircleCheckBig },
  { key: 'unpublished', label: 'Não publicados', Icon: CircleDashed },
  { key: 'all', label: 'Todos', Icon: List },
];

export default function CourseBrowser() {
  const { activeWorkspaceId, getVisibleResourceIds } = useWorkspaceScope();
  const [workspacesModalCourse, setWorkspacesModalCourse] = useState(null);
  const [query, setQuery] = useState('');
  // At most one course's workspace (anotações/atividades/mensagens/alunos
  // tabs) open at a time — clicking the same course's name again collapses
  // it, clicking a different course switches to that one instead of stacking
  // multiple panels in the table.
  const [expandedCourseId, setExpandedCourseId] = useState(null);
  // Starts on "Favoritos" by default (per product decision), but falls back to
  // "Todos" when the account has no favorited/starred courses in Canvas, so
  // the first screen is never an empty dead end. Data now arrives
  // asynchronously (cache first, then a fresh fetch), so this default is
  // resolved once — via the effect below — the first time
  // either one lands, instead of synchronously from a prop like before.
  const [onlyFavorites, setOnlyFavorites] = useState(true);
  // Defaults to "Publicados" — unpublished courses aren't usually what a
  // professor is looking for on first load; "Todos" is still one click away.
  const [statusFilter, setStatusFilter] = useState('published');
  const [sort, setSort] = useState({ key: null, direction: 'asc' });
  // Tab open in the expanded course's CourseWorkspaceTabs — tracked here
  // (not only inside the tabs) so it survives a round trip to a drill-down
  // page; see courseBrowserState.js.
  const [expandedTab, setExpandedTab] = useState(null);
  const [pendingFavoriteId, setPendingFavoriteId] = useState(null);
  const [favoriteError, setFavoriteError] = useState(null);

  // Stale-while-revalidate via TanStack Query (ADR-0015): pinta na hora com
  // o cache do IndexedDB (marcado `stale`) e revalida em segundo plano quando
  // passou da faixa `volatile` (a lista traz contadores de pendências e
  // mensagens). "Recarregar" força a busca. Primeira visita (sem cache algum)
  // mostra o carregamento em vez de uma tabela vazia.
  const queryClient = useQueryClient();
  const coursesQuery = useCoursesQuery();
  const courseList = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const { hasData: hasCache, fetchedAt, stale } = cacheStatus(coursesQuery);
  const loading = coursesQuery.isFetching || (coursesQuery.isPending && !hasCache);
  const loadError = coursesQuery.error?.message ?? null;
  const fetchFresh = () => coursesQuery.refetch();

  const appliedDefaultFilterRef = useRef(false);
  const userToggledFavoritesRef = useRef(false);

  // Restore the list as it was this session (BackButton / back gesture from
  // correção, pares, importação). Runs before the default-favorites effect
  // below, and flags the favorites choice as the user's so that effect
  // doesn't override it. Effect (not useState initializer) because the
  // server render can't read sessionStorage.
  const restoredRef = useRef(false);
  const scrollToExpandedRef = useRef(false);
  useEffect(() => {
    const saved = readCourseBrowserState();
    if (saved) {
      if (typeof saved.query === 'string') setQuery(saved.query);
      if (typeof saved.onlyFavorites === 'boolean') {
        userToggledFavoritesRef.current = true;
        setOnlyFavorites(saved.onlyFavorites);
      }
      if (saved.statusFilter) setStatusFilter(saved.statusFilter);
      if (saved.sort) setSort(saved.sort);
      if (saved.expandedCourseId != null) {
        setExpandedCourseId(saved.expandedCourseId);
        setExpandedTab(saved.expandedTab || null);
        scrollToExpandedRef.current = true;
      }
    }
    restoredRef.current = true;
  }, []);

  useEffect(() => {
    if (!restoredRef.current) return;
    writeCourseBrowserState({ query, onlyFavorites, statusFilter, sort, expandedCourseId, expandedTab });
  }, [query, onlyFavorites, statusFilter, sort, expandedCourseId, expandedTab]);

  // Bring the restored expanded row back into view once it's rendered.
  useEffect(() => {
    if (!scrollToExpandedRef.current || expandedCourseId == null) return;
    const row = document.querySelector(`[data-course-row="${expandedCourseId}"]`);
    if (!row) return;
    scrollToExpandedRef.current = false;
    row.scrollIntoView({ block: 'start' });
  });

  function toggleExpanded(courseId) {
    setExpandedTab(null);
    setExpandedCourseId((current) => (current === courseId ? null : courseId));
  }

  // Resolvido uma única vez, quando o primeiro dado chega (cache ou rede).
  useEffect(() => {
    if (!coursesQuery.data || appliedDefaultFilterRef.current || userToggledFavoritesRef.current) return;
    appliedDefaultFilterRef.current = true;
    if (!coursesQuery.data.some((c) => c.is_favorite)) setOnlyFavorites(false);
  }, [coursesQuery.data]);

  const favoritesCount = useMemo(() => courseList.filter((c) => c.is_favorite).length, [courseList]);
  const publishedCount = useMemo(() => courseList.filter(isPublished).length, [courseList]);
  const unpublishedCount = courseList.length - publishedCount;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const visibleCourseIds = activeWorkspaceId === BASE_WORKSPACE_ID ? null : getVisibleResourceIds('course');
    return courseList.filter((course) => {
      if (visibleCourseIds && !visibleCourseIds.has(String(course.id))) return false;
      if (onlyFavorites && !course.is_favorite) return false;
      if (statusFilter === 'published' && !isPublished(course)) return false;
      if (statusFilter === 'unpublished' && isPublished(course)) return false;
      if (!term) return true;
      return (
        course.name?.toLowerCase().includes(term) || course.course_code?.toLowerCase().includes(term)
      );
    });
  }, [courseList, query, onlyFavorites, statusFilter, activeWorkspaceId, getVisibleResourceIds]);

  function setFavoriteInCache(courseId, isFavorite) {
    queryClient.setQueryData(canvasKeys.courses, (prev) =>
      prev?.map((c) => (c.id === courseId ? { ...c, is_favorite: isFavorite } : c)),
    );
  }

  // Otimista direto no cache da consulta (que também é o persistido): a
  // próxima pintura a partir do IndexedDB já vem com o favorito novo.
  async function toggleFavorite(course) {
    const nextFavorite = !course.is_favorite;
    setPendingFavoriteId(course.id);
    setFavoriteError(null);
    // Uma revalidação em voo não pode sobrescrever o otimista com o valor antigo.
    await queryClient.cancelQueries({ queryKey: canvasKeys.courses, exact: true });
    setFavoriteInCache(course.id, nextFavorite);

    try {
      const response = await fetch(`/api/canvas/courses/${course.id}/favorite`, {
        method: nextFavorite ? 'POST' : 'DELETE',
      });
      if (!response.ok) throw new Error();
    } catch {
      setFavoriteInCache(course.id, course.is_favorite);
      setFavoriteError(`Não foi possível ${nextFavorite ? 'favoritar' : 'desfavoritar'} "${course.name}". Tente novamente.`);
    } finally {
      setPendingFavoriteId(null);
    }
  }

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

  function handleSetOnlyFavorites(value) {
    userToggledFavoritesRef.current = true;
    setOnlyFavorites(value);
  }

  // Nothing to show yet at all (no cache, first fetch still in flight) —
  // the filter controls below would be meaningless with an empty list.
  if (loading && !hasCache) {
    return (
      <div className="course-browser">
        <p className="lede">Carregando cursos…</p>
      </div>
    );
  }

  if (!loading && courseList.length === 0) {
    return (
      <div className="course-browser">
        {loadError ? (
          <p className="alert alert-error" role="alert">
            {loadError}
          </p>
        ) : (
          <p className="lede">Nenhum curso encontrado para esta conta.</p>
        )}
      </div>
    );
  }

  return (
    <div className="course-browser">
      <div className="browser-controls">
        <input
          type="search"
          className="search-input"
          placeholder="Pesquisar por nome ou código..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Pesquisar cursos"
        />
        <div className="segmented" role="group" aria-label="Filtrar por favorito">
          <button
            type="button"
            className={`segmented-btn${onlyFavorites ? ' active' : ''}`}
            onClick={() => handleSetOnlyFavorites(true)}
            title={`Favoritos (${favoritesCount})`}
          >
            <Star size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
            <span className="segmented-btn-text">Favoritos ({favoritesCount})</span>
          </button>
          <button
            type="button"
            className={`segmented-btn${!onlyFavorites ? ' active' : ''}`}
            onClick={() => handleSetOnlyFavorites(false)}
            title={`Todos (${courseList.length})`}
          >
            <List size={14} strokeWidth={2} aria-hidden="true" />
            <span className="segmented-btn-text">Todos ({courseList.length})</span>
          </button>
        </div>
        <div className="segmented" role="group" aria-label="Filtrar por status de publicação">
          {STATUS_FILTERS.map(({ key, label, Icon }) => {
            const count = key === 'all' ? courseList.length : key === 'published' ? publishedCount : unpublishedCount;
            return (
              <button
                key={key}
                type="button"
                className={`segmented-btn${statusFilter === key ? ' active' : ''}`}
                onClick={() => setStatusFilter(key)}
                title={`${label} (${count})`}
              >
                <Icon size={14} strokeWidth={2} aria-hidden="true" />
                <span className="segmented-btn-text">
                  {label} ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {favoriteError && (
        <p className="alert alert-error" role="alert">
          {favoriteError}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="lede">
          {onlyFavorites && favoritesCount === 0
            ? 'Você ainda não marcou nenhum curso como favorito/em destaque no Canvas.'
            : 'Nenhum curso encontrado com esse filtro ou pesquisa.'}
        </p>
      ) : (
        <>
        <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="expand-cell">
                <span className="sr-only">Expandir</span>
              </th>
              <th className="status-cell" aria-sort={sortAria('status')}>
                <button
                  type="button"
                  className="th-sort-btn"
                  onClick={() => toggleSort('status')}
                  title="Status de publicação"
                >
                  <Megaphone size={16} strokeWidth={1.8} className="col-icon" aria-hidden="true" />
                  <span className="sr-only">Status de publicação</span>
                  <SortIcon direction={sort.key === 'status' ? sort.direction : null} />
                </button>
              </th>
              <th className="fav-cell" aria-sort={sortAria('favorite')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('favorite')}>
                  <span className="sr-only">Favorito</span>
                  <SortIcon direction={sort.key === 'favorite' ? sort.direction : null} />
                </button>
              </th>
              <th className="role-cell">
                <span className="col-icon" title="Meu papel no curso">
                  <BookOpen size={16} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="sr-only">Meu papel no curso</span>
              </th>
              <th aria-sort={sortAria('name')}>
                <button type="button" className="th-sort-btn" onClick={() => toggleSort('name')}>
                  Curso
                  <SortIcon direction={sort.key === 'name' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('pending')}>
                <button
                  type="button"
                  className="th-sort-btn"
                  onClick={() => toggleSort('pending')}
                  title="Correções pendentes"
                >
                  <ClipboardCheck size={16} strokeWidth={1.8} className="col-icon" aria-hidden="true" />
                  <span className="sr-only">Correções pendentes</span>
                  <SortIcon direction={sort.key === 'pending' ? sort.direction : null} />
                </button>
              </th>
              <th aria-sort={sortAria('messages')}>
                <button
                  type="button"
                  className="th-sort-btn"
                  onClick={() => toggleSort('messages')}
                  title="Mensagens"
                >
                  <Mail size={16} strokeWidth={1.8} className="col-icon" aria-hidden="true" />
                  <span className="sr-only">Mensagens</span>
                  <SortIcon direction={sort.key === 'messages' ? sort.direction : null} />
                </button>
              </th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((course) => {
              const expanded = expandedCourseId === course.id;
              return (
              <Fragment key={course.id}>
              <tr className={expanded ? 'is-expanded' : undefined} data-course-row={course.id}>
                <td className="expand-cell">
                  <button
                    type="button"
                    className="row-expand-btn"
                    onClick={() => toggleExpanded(course.id)}
                    aria-expanded={expanded}
                    aria-label={expanded ? 'Recolher curso' : 'Expandir curso'}
                  >
                    <span className={`group-chevron${expanded ? ' expanded' : ''}`} aria-hidden="true">
                      <ChevronRight size={16} strokeWidth={2} />
                    </span>
                  </button>
                </td>
                <td className="status-cell">
                  <StatusIcon status={toStatus(course.workflow_state)} />
                </td>
                <td className="fav-cell">
                  <button
                    type="button"
                    className={`fav-toggle-btn${course.is_favorite ? ' is-favorite' : ''}`}
                    onClick={() => toggleFavorite(course)}
                    disabled={pendingFavoriteId === course.id}
                    title={course.is_favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                    aria-label={course.is_favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                    aria-pressed={course.is_favorite}
                  >
                    <Star size={16} strokeWidth={1.8} fill={course.is_favorite ? 'currentColor' : 'none'} />
                  </button>
                </td>
                <td className="role-cell">
                  {course.user_role ? (
                    <span
                      className="role-icon"
                      title={course.user_role === 'teacher' ? 'Professor' : 'Aluno'}
                      role="img"
                      aria-label={course.user_role === 'teacher' ? 'Professor' : 'Aluno'}
                    >
                      <BookOpen size={16} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                  ) : null}
                </td>
                <td className="course-name-cell">
                  <button
                    type="button"
                    className="course-name-btn"
                    onClick={() => toggleExpanded(course.id)}
                    title="Ver curso (anotações, atividades, mensagens, alunos)"
                    aria-expanded={expanded}
                  >
                    {course.name}
                  </button>
                  <Link
                    href={`/courses/${course.id}`}
                    className="external-link-icon"
                    title="Abrir página do curso"
                    aria-label="Abrir página do curso"
                  >
                    <Maximize2 size={14} strokeWidth={1.8} />
                  </Link>
                </td>
                <td className="pending-cell">
                  {course.needs_grading_count ? (
                    <span className="pending-badge has-pending">{course.needs_grading_count}</span>
                  ) : null}
                </td>
                <td className="pending-cell">
                  {course.message_count === undefined ? (
                    <span className="pending-badge" title="Só cursos favoritos têm mensagens carregadas">
                      —
                    </span>
                  ) : course.message_count === null ? (
                    <span className="pending-badge" title="Não foi possível carregar as mensagens">
                      —
                    </span>
                  ) : course.message_count === 0 ? null : (
                    <span className="pending-badge has-pending">{course.message_count}</span>
                  )}
                </td>
                <td className="actions-cell">
                  <a
                    href={course.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-icon"
                    title="Abrir curso no Canvas"
                    aria-label="Abrir curso no Canvas"
                  >
                    <ExternalLink size={18} strokeWidth={1.8} />
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon"
                    title="Workspaces deste curso"
                    aria-label="Workspaces deste curso"
                    onClick={() => setWorkspacesModalCourse(course)}
                  >
                    <Layers size={18} strokeWidth={1.8} />
                  </button>
                </td>
              </tr>
              {expanded && (
                <tr className="course-note-row">
                  <td colSpan={8}>
                    <CourseWorkspaceTabs
                      courseId={course.id}
                      courseCode={course.course_code}
                      expandHref={`/courses/${course.id}`}
                      initialTab={expandedTab}
                      onTabChange={setExpandedTab}
                    />
                  </td>
                </tr>
              )}
              </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>

        <ul className="icon-legend">
          <li>
            <Star size={14} strokeWidth={1.8} fill="currentColor" aria-hidden="true" /> Favorito
          </li>
          <li>
            <BookOpen size={14} strokeWidth={1.8} aria-hidden="true" /> Meu papel (professor/aluno)
          </li>
          <li>
            <ClipboardCheck size={14} strokeWidth={1.8} aria-hidden="true" /> Correções pendentes
          </li>
          <li>
            <Megaphone size={14} strokeWidth={1.8} aria-hidden="true" /> Status de publicação
          </li>
          <li>
            <Mail size={14} strokeWidth={1.8} aria-hidden="true" /> Mensagens
          </li>
          <li>
            <Maximize2 size={14} strokeWidth={1.8} aria-hidden="true" /> Abrir página do curso
          </li>
          <li>
            <ExternalLink size={14} strokeWidth={1.8} aria-hidden="true" /> Abrir curso no Canvas
          </li>
        </ul>
        </>
      )}

      <div className="cache-footer">
        <span className="cache-footer-info">
          {fetchedAt
            ? `Carregado em ${formatDateTime(fetchedAt)}${stale ? ' — dados salvos, atualizando em segundo plano…' : ''}`
            : 'Carregando…'}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={fetchFresh} disabled={loading}>
          <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />
          {loading ? 'Atualizando…' : 'Recarregar'}
        </button>
      </div>

      {loadError && (
        <p className="alert alert-error" role="alert">
          {loadError}
        </p>
      )}

      {workspacesModalCourse && (
        <ResourceWorkspacesModal
          resourceType="course"
          resourceId={workspacesModalCourse.id}
          title={`Workspaces de "${workspacesModalCourse.name}"`}
          onClose={() => setWorkspacesModalCourse(null)}
        />
      )}
    </div>
  );
}
