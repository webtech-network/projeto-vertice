'use client';

import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useTasks } from './TasksProvider';

// Toolbar search next to QuickAddTask — writes straight into the shared
// `filters.search` (applyFilters in src/lib/tasks/filters.js), so it applies
// live to Kanban, Eisenhower and Tabela alike. Like the other filters, it
// resets on every visit. "/" focuses it from anywhere on the page (unless
// already typing somewhere); Esc clears it.
export default function TaskSearch() {
  const { filters, setFilters } = useTasks();
  const inputRef = useRef(null);
  const value = filters.search || '';

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (typing || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function setSearch(search) {
    setFilters({ search });
  }

  return (
    <div className={`task-search${value ? ' has-value' : ''}`} role="search">
      <Search size={16} strokeWidth={1.8} className="task-search-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            setSearch('');
          }
        }}
        placeholder="Buscar…"
        aria-label="Buscar tarefas por título, descrição ou tag"
        title="Buscar tarefas (atalho: /)"
        enterKeyHint="search"
      />
      {value && (
        <button
          type="button"
          className="task-search-clear"
          onClick={() => {
            setSearch('');
            inputRef.current?.focus();
          }}
          title="Limpar busca"
          aria-label="Limpar busca"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
