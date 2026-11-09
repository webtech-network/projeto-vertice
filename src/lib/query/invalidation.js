import { getQueryClient } from './queryClient';
import { canvasKeys } from './canvasQueries';

// Invalidações após mutações no Canvas (ADR-0015). Invalidar só marca como
// vencido: consultas na tela revalidam já; as demais, quando forem lidas de
// novo. Nunca lançam — falhar aqui não pode quebrar o fluxo que já deu certo.

function invalidate(filters) {
  getQueryClient()
    .invalidateQueries(Array.isArray(filters) ? { queryKey: filters } : filters)
    .catch(() => {});
}

// ['canvas', 'courses', <id>, 'messages'] de qualquer curso.
const anyCourseMessages = {
  predicate: (query) =>
    query.queryKey[0] === 'canvas' && query.queryKey[1] === 'courses' && query.queryKey[3] === 'messages',
};

// Nota enviada: muda needs_grading_count da atividade, do curso e do painel.
export function invalidateAfterGrading(courseId) {
  invalidate(canvasKeys.assignments(courseId));
  invalidate(canvasKeys.courses);
  invalidate(canvasKeys.dashboardSummary);
}

// Mensagem enviada/respondida/arquivada: caixa de entrada, mensagens do curso
// (de todos, quando o curso não é conhecido — ex.: resposta na caixa geral) e
// contadores (lista de cursos e painel).
export function invalidateAfterMessaging(courseId) {
  invalidate(canvasKeys.messagesInbox);
  invalidate(courseId ? canvasKeys.courseMessages(courseId) : anyCourseMessages);
  invalidate(canvasKeys.courses);
  invalidate(canvasKeys.dashboardSummary);
}
