'use client';

import { GraduationCap, Presentation } from 'lucide-react';
import { useViewRole } from './ViewRoleProvider';
import { APP_VIEW_ROLE_LABELS } from '@/lib/courseRoles';

const OPTIONS = [
  { value: 'teacher', label: APP_VIEW_ROLE_LABELS.teacher, Icon: Presentation },
  { value: 'student', label: APP_VIEW_ROLE_LABELS.student, Icon: GraduationCap },
];

export default function ViewRoleSwitcher() {
  const { viewRole, setViewRole, canSwitchRole } = useViewRole();

  if (!canSwitchRole) {
    return (
      <span
        className="topbar-role-badge"
        title="Sua conta no Canvas possui apenas matrícula de aluno"
      >
        <GraduationCap size={14} strokeWidth={1.8} aria-hidden="true" />
        <span>Aluno</span>
      </span>
    );
  }

  return (
    <div className="segmented topbar-role-switch" role="radiogroup" aria-label="Visão da interface">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={viewRole === value}
          aria-label={`Visão ${label}`}
          title={`Alternar para visão ${label}`}
          className={`segmented-btn${viewRole === value ? ' active' : ''}`}
          onClick={() => setViewRole(value)}
        >
          <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
          <span className="topbar-role-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
