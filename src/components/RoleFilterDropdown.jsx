'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Users, GraduationCap, Presentation, UserCog, Palette, Eye } from 'lucide-react';
import { COURSE_ROLES, COURSE_ROLE_LABELS } from '@/lib/courseRoles';

const ROLE_ICONS = {
  teacher: Presentation,
  ta: UserCog,
  designer: Palette,
  student: GraduationCap,
  observer: Eye,
};

// Filtro de papel do painel de cursos — dropdown multisseleção, sempre
// visível (inclusive para quem tem um papel só). Cada clique liga/desliga um
// papel e o menu continua aberto; "Todos" limpa a seleção (vazio = todos os
// papéis). Mesmo popover/click-outside/Escape de WorkspaceSwitcher.jsx, cujas
// classes reaproveita para manter o visual idêntico.
export default function RoleFilterDropdown({ selected, counts, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const allActive = selected.length === 0;
  const label = allActive
    ? 'Todos os papéis'
    : selected.length === 1
      ? COURSE_ROLE_LABELS[selected[0]]
      : `${selected.length} papéis`;

  function toggle(role) {
    onChange(selected.includes(role) ? selected.filter((r) => r !== role) : [...selected, role]);
  }

  return (
    <div className="workspace-switcher role-filter" ref={containerRef}>
      <button
        type="button"
        className="workspace-switcher-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Filtrar por papel no curso"
      >
        <Users size={14} strokeWidth={1.8} aria-hidden="true" />
        <span className="workspace-switcher-label">{label}</span>
        <ChevronDown size={14} strokeWidth={1.8} />
      </button>

      {open && (
        <div className="workspace-switcher-popover" role="menu" aria-label="Filtrar por papel no curso">
          <ul className="workspace-switcher-list">
            <li>
              <button
                type="button"
                className={`workspace-switcher-item${allActive ? ' active' : ''}`}
                role="menuitemcheckbox"
                aria-checked={allActive}
                onClick={() => onChange([])}
              >
                <Users size={14} strokeWidth={1.8} aria-hidden="true" />
                Todos
                {allActive && <Check size={14} strokeWidth={2.2} />}
              </button>
            </li>
            {COURSE_ROLES.map((role) => {
              const Icon = ROLE_ICONS[role];
              const active = selected.includes(role);
              return (
                <li key={role}>
                  <button
                    type="button"
                    className={`workspace-switcher-item${active ? ' active' : ''}`}
                    role="menuitemcheckbox"
                    aria-checked={active}
                    onClick={() => toggle(role)}
                  >
                    <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                    {COURSE_ROLE_LABELS[role]} ({counts[role] ?? 0})
                    {active && <Check size={14} strokeWidth={2.2} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
