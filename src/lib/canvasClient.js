import axios from 'axios';

function parseLinkHeader(linkHeader) {
  if (!linkHeader) return {};
  const links = {};
  linkHeader.split(',').forEach((part) => {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      links[match[2]] = match[1];
    }
  });
  return links;
}

// Accepts either a bare domain (https://school.instructure.com, used by the
// web app's CANVAS_DOMAIN) or a domain already carrying /api/v1 (the CLI's
// long-standing CANVAS_API_URL convention) and normalizes to the bare domain.
function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/$/, '').replace(/\/api\/v1$/, '');
}

// An unhandled axios error carries the raw Bearer token twice: in
// `error.config.headers.Authorization`, and — via the Node http adapter —
// in `error.request._header`, the literal raw HTTP request line/headers as
// text. Both end up verbatim in Next.js's dev error overlay/console (and
// would in any other unredacted logger) if a Canvas call throws uncaught.
// Every rejection from this client goes through here first so a real access
// token never has a path to a log file.
function sanitizeAxiosError(error) {
  if (error?.config?.headers?.Authorization) {
    error.config.headers.Authorization = '[redacted]';
  }
  delete error?.request; // carries the raw request line/headers as text — not worth trying to scrub in place
  return error;
}

/**
 * Creates an axios instance for the Canvas API. Deliberately agnostic to how
 * the token was obtained (personal access token for the CLI, OAuth access
 * token for the web app): callers that hold an OAuth refresh token can pass
 * `onUnauthorized`, an async function returning a fresh access token, which
 * is invoked once on a 401 to self-heal a single request. It is not this
 * module's job to persist a refreshed token anywhere (e.g. a session cookie)
 * — that's the caller's concern.
 */
export function createClient({ baseUrl, token, onUnauthorized }) {
  let currentToken = token;

  const instance = axios.create({
    baseURL: `${normalizeBaseUrl(baseUrl)}/api/v1`,
  });

  instance.interceptors.request.use((config) => {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${currentToken}`;
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      if (error.response?.status === 401 && onUnauthorized && !original._retried) {
        original._retried = true;
        try {
          const newToken = await onUnauthorized();
          if (!newToken) throw error;
          currentToken = newToken;
          return instance(original);
        } catch {
          return Promise.reject(sanitizeAxiosError(error));
        }
      }
      return Promise.reject(sanitizeAxiosError(error));
    },
  );

  return instance;
}

async function fetchAllPages(client, url, params) {
  let results = [];
  let nextUrl = url;
  let nextParams = params;

  while (nextUrl) {
    const response = await client.get(nextUrl, nextParams ? { params: nextParams } : undefined);
    results = results.concat(response.data);
    nextParams = undefined; // subsequent Link-header URLs already encode the original query params
    nextUrl = parseLinkHeader(response.headers.link).next || null;
  }

  return results;
}

export async function getSelf(client) {
  const response = await client.get('/users/self');
  return response.data;
}

export async function getCourse(client, courseId) {
  const response = await client.get(`/courses/${courseId}`);
  return response.data;
}

/**
 * Lists the instructor's courses. Defaults to active courses where the user
 * is enrolled as teacher, since this is an instructor-facing import tool;
 * pass enrollmentType: null to list every enrollment type instead (useful
 * for a TA-only account). Always requests include[]=favorites (for the
 * "is_favorite" filter in the UI), include[]=needs_grading_count (Canvas's
 * own server-computed pending-grading total per course, shown in the courses
 * table), and include[]=total_students (Canvas's own server-computed
 * enrollment count, used by the dashboard's student-count tile) — all valid
 * on this general /courses endpoint, not just the favorites-only one.
 */
export async function listCourses(client, { enrollmentType = 'teacher', enrollmentState = 'active' } = {}) {
  return fetchAllPages(client, '/courses', {
    per_page: 100,
    'include[]': ['favorites', 'needs_grading_count', 'total_students'],
    ...(enrollmentState ? { enrollment_state: enrollmentState } : {}),
    ...(enrollmentType ? { enrollment_type: enrollmentType } : {}),
  });
}

/**
 * Lists a course's assignments (Canvas's Assignment object includes
 * needs_grading_count, published, and quiz_id by default — no extra
 * include[] needed). `quiz_id` is only present for classic-quiz assignments
 * (submission_types: ['online_quiz']) — that's the field our question-import
 * flow needs. Don't confuse it with `is_quiz_assignment`, which flags New
 * Quizzes (LTI) assignments that this app's import endpoint cannot target.
 */
export async function listAssignments(client, courseId) {
  return fetchAllPages(client, `/courses/${courseId}/assignments`, { per_page: 100 });
}

/**
 * Fetches one assignment's full detail. Used by the rubric-grading page
 * instead of trusting whatever `listAssignments` already returned — Canvas's
 * docs confirm `rubric` (a flat array of criteria) is included on the
 * Assignment object whenever a rubric is associated, but that's only
 * documented for this single-assignment show action, not the list one, so
 * we fetch fresh here rather than assume the list response carries it too.
 */
export async function getAssignment(client, courseId, assignmentId) {
  const response = await client.get(`/courses/${courseId}/assignments/${assignmentId}`);
  return response.data;
}

/**
 * Lists an assignment's submissions — one per enrolled student, including
 * those who haven't submitted anything yet (Canvas creates a placeholder
 * "unsubmitted" record per student). Group assignments aren't specially
 * handled here (out of scope for the rubric-grading feature this backs —
 * see RubricGrader.jsx). `include[]=user` brings each submission's student
 * name; `include[]=rubric_assessment` brings any prior grading, keyed by
 * criterion id, so a grading screen can pre-fill already-graded rows.
 */
export async function listSubmissions(client, courseId, assignmentId, { include = [] } = {}) {
  return fetchAllPages(client, `/courses/${courseId}/assignments/${assignmentId}/submissions`, {
    per_page: 100,
    ...(include.length ? { 'include[]': include } : {}),
  });
}

/**
 * Grades one student's submission. `payload` is expected to already be in
 * Canvas's nested shape — `{ rubric_assessment: { [criterionId]: { points,
 * rating_id, comments } }, submission: { posted_grade }, comment:
 * { text_comment } }` (see src/lib/rubricGrading.js's buildGradePayload) —
 * sent as a plain JSON body; Canvas parses nested JSON the same way it
 * parses the bracket-notation form params its own docs show. `posted_grade`
 * is sent explicitly (the summed rubric points) rather than relying on
 * Canvas auto-computing it from the rubric, so behavior doesn't depend on
 * the assignment's own "use rubric for grading" setting.
 */
export async function gradeSubmissionWithRubric(client, courseId, assignmentId, userId, payload) {
  const response = await client.put(`/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`, payload);
  return response.data;
}

export async function getQuiz(client, courseId, quizId) {
  const response = await client.get(`/courses/${courseId}/quizzes/${quizId}`);
  return response.data;
}

export async function createQuestion(client, courseId, quizId, payload) {
  const response = await client.post(`/courses/${courseId}/quizzes/${quizId}/questions`, payload);
  return response.data;
}

/**
 * Lists the current user's Inbox conversations (Canvas's messaging system),
 * optionally scoped with the same course-context filter Canvas's own Inbox
 * UI uses (`filter: ['course_123']`) — this doesn't mean a conversation
 * "belongs" to that course permanently, it means the conversation shares
 * that context with the current user, which is Canvas's own notion of
 * "messages for this course". Excludes archived conversations by default,
 * same as the default (no `scope`) Inbox view in Canvas's own UI.
 */
export async function listConversations(client, { filter, scope } = {}) {
  return fetchAllPages(client, '/conversations', {
    per_page: 100,
    ...(scope ? { scope } : {}),
    ...(filter && filter.length ? { 'filter[]': filter } : {}),
  });
}

/**
 * Fetches one conversation's full thread — unlike the list endpoint (whose
 * `last_message` is just a one-line synthesis), this returns a `messages`
 * array with every individual message's author, timestamp, full body, and
 * attachments. Fetched on demand (only when a row is expanded in the UI),
 * not eagerly for every conversation in a list.
 */
export async function getConversation(client, conversationId) {
  const response = await client.get(`/conversations/${conversationId}`);
  return response.data;
}

export async function archiveConversation(client, conversationId) {
  const response = await client.put(`/conversations/${conversationId}`, {
    conversation: { workflow_state: 'archived' },
  });
  return response.data;
}

/**
 * Replies to an existing conversation by adding a new message to its thread.
 * `recipients` is deliberately omitted — Canvas defaults it to every current
 * participant of the conversation, which is exactly "reply to this thread".
 */
export async function replyToConversation(client, conversationId, body) {
  const response = await client.post(`/conversations/${conversationId}/add_message`, { body });
  return response.data;
}

/**
 * Lists the course's active students (Canvas's short enrollment_type form —
 * 'student', not 'StudentEnrollment'). Used both to build an explicit
 * recipient list for sending a message to "the students" of a course
 * (Canvas's own `recipients[]` shorthand only understands `course_<id>`
 * (everyone in the course: teachers/TAs included) or `group_<id>`, there is
 * no `course_<id>_students` shorthand) and to power the student report.
 *
 * `include` lets a caller opt into extra per-user detail beyond the bare
 * id/name/login_id: 'enrollments' brings enrollment_state, section
 * (course_section_id), last_activity_at, total_activity_time and — account
 * permissions allowing — grades. Canvas's own docs for this endpoint do
 * **not** list 'email' as a valid include[] value (only 'enrollments',
 * 'locked', 'avatar_url', 'test_student', 'bio', 'custom_links',
 * 'current_grading_period_scores', 'uuid') — it's requested anyway since an
 * unrecognized include[] value is silently ignored rather than erroring, and
 * some Canvas instances do return it; callers should still fall back to the
 * always-present `login_id` when `email` doesn't come back.
 *
 * `enrollment_state[]` is deliberately requested as this broader set —
 * active/invited/inactive/completed — rather than just 'active'. Canvas's
 * own filtering for this parameter on this endpoint isn't reliable enough
 * to trust blindly (observed live: students the professor had deactivated
 * in Canvas still came back labeled 'active' when only 'active' was
 * requested here). Fetching the wider set and filtering/labeling client-side
 * from each enrollment's own `enrollment_state` (see studentReport.js and
 * StudentReport.jsx's "Ocultar alunos inativos" toggle) is the only way to
 * guarantee the status shown actually matches Canvas's real data. 'rejected'
 * and 'deleted' are left out on purpose — those aren't students a professor
 * would ever expect to see in a roster.
 */
export async function listCourseStudents(client, courseId, { include = [] } = {}) {
  return fetchAllPages(client, `/courses/${courseId}/users`, {
    per_page: 100,
    'enrollment_type[]': 'student',
    'enrollment_state[]': ['active', 'invited', 'inactive', 'completed'],
    ...(include.length ? { 'include[]': include } : {}),
  });
}

/**
 * Creates a Canvas conversation. `group_conversation` is always false —
 * this app only ever sends individual, private copies to each recipient
 * (never a shared thread where recipients see each other) — Canvas requires
 * `group_conversation: true` once `recipients` exceeds 100, so callers
 * sending to a large course must chunk the recipient list themselves.
 */
export async function createConversation(client, { recipients, subject, body, contextCode }) {
  const response = await client.post('/conversations', {
    recipients,
    subject,
    body,
    context_code: contextCode,
    group_conversation: false,
  });
  return response.data;
}

export async function addCourseFavorite(client, courseId) {
  const response = await client.post(`/users/self/favorites/courses/${courseId}`);
  return response.data;
}

export async function removeCourseFavorite(client, courseId) {
  const response = await client.delete(`/users/self/favorites/courses/${courseId}`);
  return response.data;
}
