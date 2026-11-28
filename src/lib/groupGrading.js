import { listSubmissions } from './canvasClient';
import { mapWithConcurrency } from './concurrency';

// Canvas's own `needs_grading_count` (on both the Assignment and the Course
// list endpoints) counts one per *student* submission needing grading — for
// a group assignment that isn't graded individually, every member of a
// group shares the same pending submission, so that overcounts. This
// recomputes it as one per *group* still needing grading (plus one per
// still-ungrouped student, who grade individually regardless of the
// assignment's group setting). Shared by the atividades table, the courses
// panel, and the dashboard summary — anywhere Canvas's raw count is shown.
export function isRealGroupAssignment(assignment) {
  return Boolean(assignment.group_category_id) && !assignment.grade_group_students_individually;
}

function submissionNeedsGrading(submission) {
  return submission.workflow_state === 'submitted' && !submission.excused;
}

export async function correctedGroupNeedsGradingCount(client, courseId, assignment) {
  const submissions = await listSubmissions(client, courseId, assignment.id, { include: ['group'] });
  const seenGroupIds = new Set();
  let count = 0;
  for (const submission of submissions) {
    if (!submissionNeedsGrading(submission)) continue;
    const groupId = submission.group?.id;
    if (groupId) {
      if (seenGroupIds.has(groupId)) continue;
      seenGroupIds.add(groupId);
    }
    count += 1;
  }
  return count;
}

/**
 * Best-effort: given a course's assignments (already fetched), returns the
 * corrected total pending-grading count for that course — Canvas's own
 * per-assignment counts for non-group (or individually-graded) assignments,
 * plus a recomputed group-aware count for real group assignments. Any
 * assignment whose submissions can't be fetched falls back to Canvas's own
 * (possibly overcounted) number rather than failing the whole course.
 */
export async function correctedCourseNeedsGradingCount(client, courseId, assignments) {
  let total = 0;
  const groupAssignments = [];
  for (const assignment of assignments) {
    const raw = assignment.needs_grading_count ?? 0;
    if (!raw) continue;
    if (!isRealGroupAssignment(assignment)) {
      total += raw;
    } else {
      groupAssignments.push(assignment);
    }
  }
  if (groupAssignments.length === 0) return total;

  const groupCounts = await mapWithConcurrency(groupAssignments, 4, async (assignment) => {
    try {
      return await correctedGroupNeedsGradingCount(client, courseId, assignment);
    } catch {
      return assignment.needs_grading_count ?? 0;
    }
  });
  for (const count of groupCounts) total += count;
  return total;
}
