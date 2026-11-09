import { getQueryClient, STALE, waitForCacheRestore } from '../query/queryClient';
import { canvasKeys, fetchCourses, fetchCourseAssignments, fetchCourseStudents } from '../query/canvasQueries';

// Resolves a Task/Project's Canvas id references (courseId/assignmentId/
// studentId) into display names, without ever storing that data in the
// tasks' own records (Canvas stays the source of truth).
//
// Backed by the same TanStack Query cache as the rest of the app (ADR-0015):
// same keys as CourseBrowser/CourseWorkspaceTabs, so a course list or roster
// already loaded anywhere is reused here. Names barely change during a
// semester, so these helpers accept anything within the `stable` tier
// (12 h) — screens that show volatile counters revalidate on their own.
// On a network failure they fall back to whatever is cached, even if stale.

async function cachedFetch(queryKey, queryFn, fallback) {
  await waitForCacheRestore();
  const client = getQueryClient();
  try {
    return await client.fetchQuery({ queryKey, queryFn, staleTime: STALE.stable });
  } catch {
    return client.getQueryData(queryKey) ?? fallback;
  }
}

export function listCoursesCached() {
  return cachedFetch(canvasKeys.courses, fetchCourses, []);
}

export function listCourseAssignments(courseId) {
  if (!courseId) return Promise.resolve([]);
  return cachedFetch(canvasKeys.assignments(courseId), () => fetchCourseAssignments(courseId), []);
}

export function listCourseStudentsCached(courseId) {
  if (!courseId) return Promise.resolve([]);
  return cachedFetch(canvasKeys.students(courseId), () => fetchCourseStudents(courseId), []);
}

function findName(list, id) {
  return list?.find((item) => String(item.id) === String(id))?.name || null;
}

export async function resolveCourseName(courseId) {
  if (!courseId) return null;
  return findName(await listCoursesCached(), courseId);
}

export async function resolveAssignmentName(courseId, assignmentId) {
  if (!courseId || !assignmentId) return null;
  return findName(await listCourseAssignments(courseId), assignmentId);
}

export async function resolveStudentName(courseId, studentId) {
  if (!courseId || !studentId) return null;
  return findName(await listCourseStudentsCached(courseId), studentId);
}
