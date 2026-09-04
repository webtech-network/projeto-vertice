'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronsDown, ChevronsUp, ExternalLink, RefreshCw } from 'lucide-react';
import MessageList from './MessageList';
import { groupConversationsByCourse } from '@/lib/messageGrouping';
import { readCache, writeCache } from '@/lib/dashboardCache';
import { courseMessagesUrl } from '@/lib/canvasLinks';

const CACHE_KEY = 'messages:inbox';

function formatDateTime(timestamp) {
  if (!timestamp) return null;
  try {
    return new Date(timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return null;
  }
}

function groupKey(group) {
  return group.course ? String(group.course.id) : 'other';
}

// Courses + conversations are fetched client-side (see /api/canvas/messages)
// with an IndexedDB stale-while-revalidate cache — grouping and the course
// filter both happen client-side too, so switching courses/expanding groups
// never re-hits the Canvas API.
export default function MessageBrowser({ currentUserId, baseUrl, integrations }) {
  const [courses, setCourses] = useState([]);
  const [conversations, setConversations] = useState([]);
  // Defaults to "Mensagens diretas" (courseFilter='other', see groupKey())
  // rather than the "Todos os favoritos" empty string — direct messages are
  // the context a professor most often opens this screen to check.
  const [courseFilter, setCourseFilter] = useState('other');
  const [collapsedKeys, setCollapsedKeys] = useState(() => new Set());

  const [loading, setLoading] = useState(true);
  const [hasCache, setHasCache] = useState(false);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const fetchFresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/canvas/messages');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao carregar as mensagens.');
      setCourses(data.courses);
      setConversations(data.conversations);
      setFetchedAt(Date.now());
      setHasCache(true);
      setStale(false);
      // A partial failure (courses loaded, conversations didn't — see the
      // route's own comment) still responds 200, so this comes from the
      // payload itself rather than a thrown error.
      setLoadError(data.loadError || null);
      await writeCache(CACHE_KEY, { courses: data.courses, conversations: data.conversations });
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFromCache() {
      const cached = await readCache(CACHE_KEY);
      if (cancelled || !cached) return;
      setCourses(cached.data.courses);
      setConversations(cached.data.conversations);
      setFetchedAt(cached.fetchedAt);
      setHasCache(true);
      setStale(true);
      setLoading(false);
    }

    loadFromCache();
    fetchFresh();

    return () => {
      cancelled = true;
    };
  }, [fetchFresh]);

  // Favorite courses with zero messages don't get a section at all — the
  // select still lists every favorite course, so picking one of those just
  // shows the "nenhuma mensagem" empty state instead of an empty section.
  const groups = useMemo(
    () => groupConversationsByCourse(conversations, courses).filter((g) => g.conversations.length > 0),
    [conversations, courses],
  );
  const visibleGroups = courseFilter ? groups.filter((g) => groupKey(g) === courseFilter) : groups;

  function toggleGroup(key) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setCollapsedKeys(new Set());
  }

  function collapseAll() {
    setCollapsedKeys(new Set(groups.map(groupKey)));
  }

  // Nothing to show yet at all (no cache, first fetch still in flight) —
  // the filter controls below would be meaningless with an empty list.
  if (loading && !hasCache) {
    return (
      <div className="message-browser">
        <p className="lede">Carregando mensagens…</p>
      </div>
    );
  }

  if (!loading && courses.length === 0) {
    return (
      <div className="message-browser">
        {loadError ? (
          <p className="alert alert-error" role="alert">
            {loadError}
          </p>
        ) : (
          <p className="lede">Você ainda não marcou nenhum curso como favorito/em destaque no Canvas.</p>
        )}
      </div>
    );
  }

  return (
    <div className="message-browser">
      <div className="browser-controls">
        <div className="provider-select">
          <label htmlFor="course-filter">Contexto</label>
          <select id="course-filter" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="">Todos os favoritos</option>
            <option value="other">Mensagens diretas</option>
            {courses.map((course) => (
              <option key={course.id} value={String(course.id)}>
                {course.name}
              </option>
            ))}
          </select>
        </div>
        <div className="browser-controls-actions">
          <div className="segmented" role="group" aria-label="Expandir ou recolher grupos de mensagens">
            <button type="button" className="segmented-btn" onClick={expandAll} title="Expandir tudo">
              <ChevronsDown size={16} strokeWidth={2} aria-hidden="true" />
              Expandir tudo
            </button>
            <button type="button" className="segmented-btn" onClick={collapseAll} title="Recolher tudo">
              <ChevronsUp size={16} strokeWidth={2} aria-hidden="true" />
              Recolher tudo
            </button>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchFresh}
            disabled={loading}
            title="Recarregar mensagens"
          >
            <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />
            {loading ? 'Atualizando…' : 'Recarregar'}
          </button>
        </div>
      </div>

      {loadError && (
        <p className="alert alert-error" role="alert">
          {loadError}
        </p>
      )}

      {visibleGroups.length === 0 ? (
        <p className="lede">Nenhuma mensagem encontrada.</p>
      ) : (
        visibleGroups.map((group) => {
          const key = groupKey(group);
          const collapsed = collapsedKeys.has(key);
          const title = group.course ? group.course.name : 'Mensagens diretas';
          return (
            <section className="message-group" key={key}>
              <div className="message-group-header">
                <button
                  type="button"
                  className="message-group-toggle"
                  onClick={() => toggleGroup(key)}
                  aria-expanded={!collapsed}
                >
                  <span className={`group-chevron${collapsed ? '' : ' expanded'}`} aria-hidden="true">
                    <ChevronRight size={16} strokeWidth={2} />
                  </span>
                  <span className="group-title">{title}</span>
                </button>
                {group.course && (
                  <a
                    href={courseMessagesUrl(baseUrl, group.course.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link-icon"
                    title="Abrir mensagens do curso no Canvas"
                    aria-label="Abrir mensagens do curso no Canvas"
                  >
                    <ExternalLink size={14} strokeWidth={1.8} />
                  </a>
                )}
                <span className={`pending-badge message-group-badge${group.conversations.length ? ' has-pending' : ''}`}>
                  {group.conversations.length}
                </span>
              </div>
              {!collapsed && (
                <div className="message-group-body">
                  <MessageList
                    conversations={group.conversations}
                    currentUserId={currentUserId}
                    baseUrl={baseUrl}
                    integrations={integrations}
                  />
                </div>
              )}
            </section>
          );
        })
      )}

      <div className="cache-footer">
        <span className="cache-footer-info">
          {fetchedAt
            ? `Carregado em ${formatDateTime(fetchedAt)}${stale ? ' — dados salvos, atualizando em segundo plano…' : ''}`
            : 'Carregando…'}
        </span>
      </div>
    </div>
  );
}
