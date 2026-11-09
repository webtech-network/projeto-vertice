// Shared builders for "open this in Canvas" deep links — `baseUrl` is
// always `session.baseUrl` (bare domain, no /api/v1), same value already
// passed around for this purpose elsewhere (see MessageList.jsx's own
// conversationUrl, which predates this file and handles a case these
// helpers don't need to: a conversation with no known course).

export function courseUrl(baseUrl, courseId) {
  return `${baseUrl}/courses/${courseId}`;
}

// Canvas's own assignments list for the course — used by the Atividades
// screen's ContextBanner icon so it deep-links straight to the equivalent
// Canvas view instead of the generic course home page.
export function courseAssignmentsUrl(baseUrl, courseId) {
  return `${baseUrl}/courses/${courseId}/assignments`;
}

// A classic quiz's own page in Canvas — used by "Questões da atividade"
// (quizzes/[quizId]/import) to jump to the quiz being filled.
export function quizUrl(baseUrl, courseId, quizId) {
  return `${baseUrl}/courses/${courseId}/quizzes/${quizId}`;
}

// Canvas's "People" page for the course — used by the Alunos screen's
// ContextBanner icon, same reasoning as courseAssignmentsUrl above.
export function coursePeopleUrl(baseUrl, courseId) {
  return `${baseUrl}/courses/${courseId}/users`;
}

// Same hash-filter format Canvas's own Inbox UI uses to deep-link into a
// single course's messages (see MessageList.jsx's conversationUrl for the
// prior art this was extracted from). `&course=course_<id>` (not the comma-
// joined `,course_<id>` the generic `type=inbox` filter uses) is what
// actually scopes the view by course on a real Canvas instance — verified
// against pucminas.instructure.com.
export function courseMessagesUrl(baseUrl, courseId) {
  return `${baseUrl}/conversations#filter=type=sent&course=course_${courseId}`;
}

// Canvas's individual-student grades page — the same "Grades" view a
// student sees for themselves, reachable by a teacher for any of their
// students via this URL (permissions-gated on Canvas's side, not this app's).
export function studentGradesUrl(baseUrl, courseId, studentId) {
  return `${baseUrl}/courses/${courseId}/grades/${studentId}`;
}

// Canvas's own grading UI for a single assignment. `baseUrl` here is usually
// derived from an item's own `html_url` (`new URL(item.htmlUrl).origin`)
// rather than session.baseUrl, since callers like RecentDeadlines.jsx only
// ever have the per-item Canvas URL on hand, not the session — same domain
// either way, just a different source for it.
export function speedGraderUrl(baseUrl, courseId, assignmentId) {
  return `${baseUrl}/courses/${courseId}/gradebook/speed_grader?assignment_id=${assignmentId}`;
}
