// Canvas conversations carry `audience_contexts.courses`, an object keyed by
// course id, reflecting which shared course context(s) the conversation
// belongs to — this is how Canvas's own Inbox course-filter works, and it's
// what lets us bucket a conversation by course without an extra API call per
// conversation or per course.
function conversationCourseIds(conversation) {
  return Object.keys(conversation.audience_contexts?.courses || {});
}

/**
 * Tallies how many conversations touch each course in `courseIds`. Courses
 * with zero matching conversations still get an explicit 0 (not omitted),
 * since the caller only ever passes course ids it already fetched for.
 */
export function countMessagesByCourse(conversations, courseIds) {
  const counts = new Map(courseIds.map((id) => [String(id), 0]));
  for (const conversation of conversations) {
    for (const courseId of conversationCourseIds(conversation)) {
      if (counts.has(courseId)) {
        counts.set(courseId, counts.get(courseId) + 1);
      }
    }
  }
  return counts;
}

/**
 * Groups conversations by course for the messages screen's collapsible
 * sections. A trailing `{ course: null, ... }` bucket holds any conversation
 * that matched no course (e.g. a direct message with no shared course
 * context) — shown last per product decision. Every course in `courses`
 * then gets a group (possibly empty, so a favorite course with no messages
 * still shows up).
 */
export function groupConversationsByCourse(conversations, courses) {
  const courseById = new Map(courses.map((c) => [String(c.id), c]));
  const groups = new Map(courses.map((c) => [String(c.id), { course: c, conversations: [] }]));
  const other = [];

  for (const conversation of conversations) {
    const matchedId = conversationCourseIds(conversation).find((id) => courseById.has(id));
    if (matchedId) {
      groups.get(matchedId).conversations.push(conversation);
    } else {
      other.push(conversation);
    }
  }

  const result = courses.map((c) => groups.get(String(c.id)));
  if (other.length) result.push({ course: null, conversations: other });
  return result;
}
