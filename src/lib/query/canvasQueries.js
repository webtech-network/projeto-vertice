import { useIsRestoring, useQuery } from '@tanstack/react-query';
import { getQueryClient, STALE, waitForCacheRestore } from './queryClient';

// Chaves, fetchers e hooks das leituras do Canvas (ADR-0015). Toda tela que
// lê estes dados passa por aqui — mesma chave = mesmo cache, deduplicação e
// invalidação por prefixo (ex.: ['canvas', 'courses', id] derruba tudo de um
// curso).

export const canvasKeys = {
  dashboardSummary: ['dashboard', 'summary'],
  courses: ['canvas', 'courses'],
  messagesInbox: ['canvas', 'messages', 'inbox'],
  course: (courseId) => ['canvas', 'courses', String(courseId)],
  assignments: (courseId) => ['canvas', 'courses', String(courseId), 'assignments'],
  students: (courseId) => ['canvas', 'courses', String(courseId), 'students'],
  courseMessages: (courseId) => ['canvas', 'courses', String(courseId), 'messages'],
  groupCategories: (courseId) => ['canvas', 'courses', String(courseId), 'group-categories'],
  categoryGroups: (courseId, categoryId) => [
    'canvas',
    'courses',
    String(courseId),
    'group-categories',
    String(categoryId),
    'groups',
  ],
  analyticsSummaries: (courseId) => ['canvas', 'courses', String(courseId), 'analytics', 'students'],
  studentAssignmentAnalytics: (courseId, studentId) => [
    'canvas',
    'courses',
    String(courseId),
    'students',
    String(studentId),
    'assignment-analytics',
  ],
  canvasStatus: ['canvas', 'status'],
  aiIntegrationsConfigured: ['ai', 'integrations', 'configured'],
};

async function fetchJson(url, fallbackMessage) {
  const response = await fetch(url);
  let data = null;
  try {
    data = await response.json();
  } catch {
    // corpo não-JSON (ex.: página de erro do proxy)
  }
  if (!response.ok) throw new Error(data?.error || fallbackMessage);
  return data;
}

// Payload inteiro (inclui `loadError` parcial, que vem com 200).
export const fetchDashboardSummary = () => fetchJson('/api/dashboard/summary', 'Falha ao carregar o painel.');

export const fetchCourses = () =>
  fetchJson('/api/canvas/courses', 'Falha ao carregar os cursos.').then((data) => data.courses);

// { courses, conversations, loadError? }
export const fetchMessagesInbox = () => fetchJson('/api/canvas/messages', 'Falha ao carregar as mensagens.');

export const fetchCourseAssignments = (courseId) =>
  fetchJson(`/api/canvas/courses/${courseId}/assignments`, 'Falha ao carregar as atividades do curso.').then(
    (data) => data.assignments,
  );

export const fetchCourseStudents = (courseId) =>
  fetchJson(`/api/canvas/courses/${courseId}/students`, 'Falha ao carregar os alunos do curso.').then(
    (data) => data.students,
  );

export const fetchCourse = (courseId) =>
  fetchJson(`/api/canvas/courses/${courseId}`, 'Falha ao carregar o curso.').then((data) => data.course);

// { conversations, loadError? }
export const fetchCourseMessages = (courseId) =>
  fetchJson(`/api/canvas/courses/${courseId}/messages`, 'Falha ao carregar as mensagens deste curso.');

export const fetchGroupCategories = (courseId) =>
  fetchJson(`/api/canvas/courses/${courseId}/group-categories`, 'Falha ao carregar os conjuntos de grupos.').then(
    (data) => data.categories || [],
  );

export const fetchCategoryGroups = (courseId, categoryId) =>
  fetchJson(
    `/api/canvas/courses/${courseId}/group-categories/${categoryId}/groups`,
    'Falha ao carregar os grupos do Canvas.',
  ).then((data) => data.groups || []);

export const fetchAnalyticsSummaries = (courseId) =>
  fetchJson(
    `/api/canvas/courses/${courseId}/analytics/students`,
    'Falha ao carregar os dados da situação dos alunos.',
  ).then((data) => data.summaries || []);

export const fetchStudentAssignmentAnalytics = (courseId, studentId) =>
  fetchJson(
    `/api/canvas/courses/${courseId}/students/${studentId}/assignment-analytics`,
    'Falha ao carregar as atividades deste aluno.',
  ).then((data) => data.assignments || []);

// { connected, baseUrl, displayName, avatarUrl, providerUserId } — nunca tokens.
export const fetchCanvasStatus = () => fetchJson('/api/canvas/status', 'Falha ao ler a conexão com o Canvas.');

// Só metadados (nome, provider, modelo) — chaves de IA são write-only (ADR-0006).
export const fetchConfiguredAiIntegrations = () =>
  fetchJson('/api/ai/integrations/configured', 'Falha ao carregar as integrações de IA.').then(
    (data) => data.integrations || [],
  );

// Leitura imperativa com stale-while-revalidate, para componentes que guardam
// o resultado no próprio estado (ex.: grupos escolhidos num <select>): devolve
// o cache na hora, mesmo vencido, e revalida em segundo plano se passou de
// `staleTime` — a próxima leitura já vem atualizada. Sem cache, espera a rede
// (e lança em caso de erro, como fetchQuery).
export async function readThrough(queryKey, queryFn, staleTime) {
  await waitForCacheRestore();
  const client = getQueryClient();
  const state = client.getQueryState(queryKey);
  if (state?.data !== undefined) {
    if (Date.now() - state.dataUpdatedAt > staleTime) {
      client.prefetchQuery({ queryKey, queryFn, staleTime: 0 });
    }
    return state.data;
  }
  return client.fetchQuery({ queryKey, queryFn, staleTime });
}

// Força a ida à rede (ex.: "Analisar situação dos alunos") e atualiza o cache.
export async function readFresh(queryKey, queryFn) {
  await waitForCacheRestore();
  return getQueryClient().fetchQuery({ queryKey, queryFn, staleTime: 0 });
}

// Nome e código de um curso: primeiro da lista de cursos já em cache (só lê,
// nunca dispara a lista — que é cara), senão GET /api/canvas/courses/[id].
// Nome e código quase não mudam — faixa `stable`.
export function useCourseQuery(courseId) {
  const isRestoring = useIsRestoring();
  const fromList = useQuery({
    queryKey: canvasKeys.courses,
    queryFn: fetchCourses,
    enabled: false,
    select: (list) => list?.find((c) => String(c.id) === String(courseId)),
  });
  const single = useQuery({
    queryKey: canvasKeys.course(courseId),
    queryFn: () => fetchCourse(courseId),
    staleTime: STALE.stable,
    enabled: Boolean(courseId) && !isRestoring && !fromList.data,
  });
  const course = fromList.data ?? single.data ?? null;
  return {
    course,
    loading: !course && (isRestoring || single.isPending),
    error: !course ? (single.error?.message ?? null) : null,
  };
}

export function useCourseMessagesQuery(courseId, { enabled = true } = {}) {
  return useQuery({
    queryKey: canvasKeys.courseMessages(courseId),
    queryFn: () => fetchCourseMessages(courseId),
    staleTime: STALE.live,
    enabled: Boolean(courseId) && enabled,
  });
}

export function useGroupCategoriesQuery(courseId) {
  return useQuery({
    queryKey: canvasKeys.groupCategories(courseId),
    queryFn: () => fetchGroupCategories(courseId),
    staleTime: STALE.volatile,
    enabled: Boolean(courseId),
  });
}

export function useStudentAssignmentAnalyticsQuery(courseId, studentId) {
  return useQuery({
    queryKey: canvasKeys.studentAssignmentAnalytics(courseId, studentId),
    queryFn: () => fetchStudentAssignmentAnalytics(courseId, studentId),
    staleTime: STALE.volatile,
    enabled: Boolean(courseId && studentId),
  });
}

export function useCanvasStatusQuery({ enabled = true } = {}) {
  return useQuery({ queryKey: canvasKeys.canvasStatus, queryFn: fetchCanvasStatus, staleTime: STALE.stable, enabled });
}

export function useConfiguredAiIntegrationsQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: canvasKeys.aiIntegrationsConfigured,
    queryFn: fetchConfiguredAiIntegrations,
    staleTime: STALE.live,
    enabled,
  });
}

export function useDashboardSummaryQuery() {
  return useQuery({ queryKey: canvasKeys.dashboardSummary, queryFn: fetchDashboardSummary, staleTime: STALE.live });
}

// Lista de cursos traz contadores voláteis (needs_grading_count,
// message_count) — por isso `volatile`, não `stable`, nesta tela.
export function useCoursesQuery() {
  return useQuery({ queryKey: canvasKeys.courses, queryFn: fetchCourses, staleTime: STALE.volatile });
}

export function useMessagesInboxQuery() {
  return useQuery({ queryKey: canvasKeys.messagesInbox, queryFn: fetchMessagesInbox, staleTime: STALE.live });
}

export function useCourseAssignmentsQuery(courseId, { enabled = true } = {}) {
  return useQuery({
    queryKey: canvasKeys.assignments(courseId),
    queryFn: () => fetchCourseAssignments(courseId),
    staleTime: STALE.volatile,
    enabled: Boolean(courseId) && enabled,
  });
}

export function useCourseStudentsQuery(courseId, { enabled = true } = {}) {
  return useQuery({
    queryKey: canvasKeys.students(courseId),
    queryFn: () => fetchCourseStudents(courseId),
    staleTime: STALE.volatile,
    enabled: Boolean(courseId) && enabled,
  });
}

// Estado de "dados salvos, atualizando em segundo plano" no formato que as
// telas já exibiam: há dado e ele está sendo revalidado (ou a revalidação
// falhou e o que aparece é o cache).
export function cacheStatus(query) {
  const hasData = query.data !== undefined;
  return {
    hasData,
    fetchedAt: hasData ? query.dataUpdatedAt : null,
    stale: hasData && (query.isFetching || query.isError),
    // Primeira visita, sem nada em cache.
    initialLoading: !hasData && (query.isPending || query.isFetching),
  };
}
