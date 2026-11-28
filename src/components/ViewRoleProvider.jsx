'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useCanvasStatusQuery } from '@/lib/query/canvasQueries';
import { getStoredViewRole, setStoredViewRole } from '@/lib/viewRolePreference';
import { ensureUiPreferencesSynced } from './UiPreferencesSync';

const ViewRoleContext = createContext({
  viewRole: 'teacher',
  setViewRole: () => {},
  availableRoles: [],
  canSwitchRole: true,
  isTeacherView: true,
  isStudentView: false,
  rolesLoaded: false,
});

export function useViewRole() {
  return useContext(ViewRoleContext);
}

/**
 * Gerencia a visão ativa do usuário ('teacher' | 'student'), combinando:
 * 1. Os papéis detectados no Canvas (integrations.metadata.roles via /api/canvas/status)
 * 2. A preferência individual salva (localStorage + ui_preferences.active_view_mode)
 *
 * Regras (ADR-0027):
 * - Conta exclusivamente 'student' no Canvas: visão fixa em 'student'.
 * - Conta com 'teacher' (sozinho ou com 'student'): pode alternar livremente
 *   entre 'teacher' e 'student' (inclusive para pré-visualizar como aluno).
 * - Conta sem Canvas conectado ou sem roles gravados: usa preferência salva
 *   (default 'teacher' para compatibilidade) e permite alternar.
 */
export function ViewRoleProvider({ children }) {
  const statusQuery = useCanvasStatusQuery();
  const [storedRole, setStoredRole] = useState(null);

  useEffect(() => {
    setStoredRole(getStoredViewRole());
    let cancelled = false;
    ensureUiPreferencesSynced()
      .then(() => {
        if (!cancelled) setStoredRole(getStoredViewRole());
      })
      .catch(() => {});

    const syncFromStorage = () => setStoredRole(getStoredViewRole());
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('vertice:view-role-change', syncFromStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('vertice:view-role-change', syncFromStorage);
    };
  }, []);

  const availableRoles = useMemo(() => {
    const roles = statusQuery.data?.roles;
    return Array.isArray(roles) ? roles : [];
  }, [statusQuery.data?.roles]);

  const isStudentOnly =
    statusQuery.data?.connected &&
    availableRoles.length > 0 &&
    !availableRoles.includes('teacher') &&
    availableRoles.includes('student');

  const canSwitchRole = !isStudentOnly;

  const viewRole = useMemo(() => {
    if (isStudentOnly) return 'student';
    if (storedRole === 'teacher' || storedRole === 'student') return storedRole;
    if (statusQuery.data?.primaryRole === 'student' || statusQuery.data?.primaryRole === 'teacher') {
      return statusQuery.data.primaryRole;
    }
    return 'teacher';
  }, [isStudentOnly, storedRole, statusQuery.data?.primaryRole]);

  const setViewRole = useCallback(
    (nextRole) => {
      if (isStudentOnly && nextRole !== 'student') return;
      if (nextRole !== 'teacher' && nextRole !== 'student') return;
      setStoredRole(nextRole);
      setStoredViewRole(nextRole);
    },
    [isStudentOnly],
  );

  const value = useMemo(
    () => ({
      viewRole,
      setViewRole,
      availableRoles,
      canSwitchRole,
      isTeacherView: viewRole === 'teacher',
      isStudentView: viewRole === 'student',
      rolesLoaded: !statusQuery.isLoading,
    }),
    [viewRole, setViewRole, availableRoles, canSwitchRole, statusQuery.isLoading],
  );

  return <ViewRoleContext.Provider value={value}>{children}</ViewRoleContext.Provider>;
}
