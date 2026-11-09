// Pure helpers behind the peer-review grading page — see
// specs/capabilities/peer-review-grading.md and ADR-0014. No I/O here: the
// page loads everything from Canvas and hands the raw arrays in.
// Every student is keyed by Canvas `user_id`, never by name (the legacy PHP
// tool keyed its participation report by name and mixed up homonyms).

export const PENALTY_MODES = {
  ALL_OR_NOTHING: 'all-or-nothing',
  PROPORTIONAL: 'proportional',
};

export function round2(value) {
  return Math.round(value * 100) / 100;
}

// Same rule as the distribution page: `attempt`/`submitted_at`, not
// workflow_state alone — a professor-graded non-submission is also 'graded'.
export function isDelivered(submission) {
  return submission.attempt != null || Boolean(submission.submitted_at);
}

function trimmed(text) {
  return typeof text === 'string' ? text.trim() : '';
}

/** Identity of one review: (reviewer, reviewed submission). */
export function reviewKey(review) {
  return `${review.reviewerId}:${review.submissionId}`;
}

/**
 * Consolidates an assignment's peer reviews into one entry per student.
 *
 * @param {object} input
 * @param {object[]} input.submissions   listSubmissions(include user, submission_comments)
 * @param {object[]} input.peerReviews   listPeerReviews
 * @param {object[]} [input.assessments] getRubric(include peer_assessments).assessments
 * @param {object[]} [input.criteria]    getRubric(...).data — for criterion descriptions
 * @param {number}   [input.rubricPoints]     rubric_settings.points_possible
 * @param {number}   [input.assignmentPoints] assignment.points_possible
 */
export function consolidatePeerReviews({
  submissions,
  peerReviews,
  assessments = [],
  criteria = [],
  rubricPoints = null,
  assignmentPoints = null,
}) {
  const hasRubric = rubricPoints != null;
  const scale = rubricPoints > 0 && assignmentPoints > 0 ? assignmentPoints / rubricPoints : 1;

  const studentSubmissions = submissions.filter((s) => s.user_id);
  const submissionIds = new Set(studentSubmissions.map((s) => s.id));
  const names = new Map(studentSubmissions.map((s) => [s.user_id, s.user?.name || `Aluno ${s.user_id}`]));
  const nameOf = (userId) => names.get(userId) || `Aluno ${userId}`;
  const criterionName = new Map(criteria.map((c) => [c.id, c.description]));

  // A rubric shared by several assignments returns assessments for all of
  // them — keep only those on this assignment's submissions.
  const assessmentByPair = new Map();
  for (const a of assessments) {
    if (!submissionIds.has(a.artifact_id)) continue;
    assessmentByPair.set(`${a.assessor_id}:${a.artifact_id}`, a);
  }

  const commentsBySubmission = new Map(
    studentSubmissions.map((s) => [
      s.id,
      (s.submission_comments || []).map((c) => ({
        authorId: c.author_id,
        authorName: c.author_name || c.author?.display_name || `Usuário ${c.author_id}`,
        text: trimmed(c.comment),
      })),
    ]),
  );

  const reviews = [];
  const seenPairs = new Set();
  for (const r of peerReviews) {
    const key = `${r.assessor_id}:${r.asset_id}`;
    if (!submissionIds.has(r.asset_id) || seenPairs.has(key)) continue;
    seenPairs.add(key);
    const assessment = assessmentByPair.get(key);
    const rubricTexts = (assessment?.data || []).filter((d) => trimmed(d.comments));
    const rubricComments = rubricTexts.map((d) => {
      const label = criterionName.get(d.criterion_id);
      return label ? `${label}: ${trimmed(d.comments)}` : trimmed(d.comments);
    });
    const submissionComments = (commentsBySubmission.get(r.asset_id) || [])
      .filter((c) => c.authorId === r.assessor_id && c.text)
      .map((c) => c.text);
    const rawScore = assessment?.score ?? null;
    reviews.push({
      key,
      reviewerId: r.assessor_id,
      reviewerName: nameOf(r.assessor_id),
      revieweeId: r.user_id,
      revieweeName: nameOf(r.user_id),
      submissionId: r.asset_id,
      rawScore,
      score: rawScore != null ? round2(rawScore * scale) : null,
      completed: r.workflow_state === 'completed' || assessment != null,
      comments: [...rubricComments, ...submissionComments],
      // What the reviewer actually wrote — without the criterion labels
      // prepended above, which would inflate the "careless" heuristic.
      commentLength:
        rubricTexts.reduce((sum, d) => sum + trimmed(d.comments).length, 0) +
        submissionComments.reduce((sum, text) => sum + text.length, 0),
      discarded: false,
    });
  }

  const base = studentSubmissions.map((s) => {
    const received = reviews.filter((r) => r.revieweeId === s.user_id);
    const reviewerIds = new Set(received.map((r) => r.reviewerId));
    return {
      userId: s.user_id,
      name: nameOf(s.user_id),
      submissionId: s.id,
      excused: Boolean(s.excused),
      delivered: isDelivered(s),
      currentScore: s.score ?? null,
      received,
      given: reviews.filter((r) => r.reviewerId === s.user_id),
      otherComments: (commentsBySubmission.get(s.id) || []).filter((c) => c.text && !reviewerIds.has(c.authorId)),
    };
  });

  base.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return {
    students: applyDiscards(base, new Set(), { hasRubric }),
    hasRubric,
    scale,
    totals: {
      assigned: reviews.length,
      completed: reviews.filter((r) => r.completed).length,
    },
  };
}

/** Population standard deviation, or null with fewer than 2 values. */
export function stdDev(values) {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return round2(Math.sqrt(variance));
}

/**
 * Derives each student's average, status, suggestion and participation from
 * the reviews that are still considered. `discarded` is a Set of reviewKey()s
 * the professor chose to ignore (careless reviews): they leave the reviewee's
 * average and count as NOT done for the reviewer. Pure — re-run on every change.
 */
export function applyDiscards(students, discarded, { hasRubric }) {
  const mark = (r) => ({ ...r, discarded: discarded.has(r.key) });
  return students.map((student) => {
    const received = student.received.map(mark);
    const given = student.given.map(mark);
    const considered = received.filter((r) => !r.discarded);

    const scores = considered.filter((r) => r.score != null).map((r) => r.score);
    const average = scores.length > 0 ? round2(scores.reduce((sum, v) => sum + v, 0) / scores.length) : null;

    // Without a rubric there are no scores — a review then counts as done
    // when Canvas marks it completed.
    const done = hasRubric ? scores.length : considered.filter((r) => r.completed).length;

    let status;
    if (student.excused) status = 'excused';
    else if (!student.delivered) status = 'missing';
    else if (done === 0) status = 'unreviewed';
    else if (done < considered.length) status = 'partial';
    else status = 'ok';

    // Decision 4 (ADR-0014): no delivery → 0 like the legacy tool;
    // delivered but never scored → no suggestion, the professor grades by hand.
    let suggested = null;
    if (status === 'missing') suggested = 0;
    else if (status === 'partial' || status === 'ok') suggested = average;

    const valid = given.filter((r) => !r.discarded);
    return {
      ...student,
      received,
      given,
      status,
      average,
      stdDev: stdDev(scores),
      suggested,
      participation: {
        assigned: given.length,
        completed: valid.filter((r) => r.completed).length,
        commented: valid.filter((r) => r.comments.length > 0).length,
        completedWithComment: valid.filter((r) => r.completed && r.comments.length > 0).length,
        discarded: given.length - valid.length,
      },
    };
  });
}

/**
 * Heuristic flag (never an automatic discard): the reviewer gave the rubric's
 * maximum score while writing fewer than `minCommentLength` characters.
 */
export function isCarelessReview(review, { rubricPoints, minCommentLength = 20 }) {
  if (review.rawScore == null || !(rubricPoints > 0)) return false;
  return review.rawScore >= rubricPoints - 1e-9 && review.commentLength < (Number(minCommentLength) || 0);
}

/**
 * Colour level for the spread of a student's received grades, relative to
 * the assignment's points: below `threshold` → 'normal', up to 2× → 'warn',
 * beyond → 'high'. null when there's no spread to judge (< 2 grades).
 */
export function dispersionLevel(sd, pointsPossible, threshold = 0.15) {
  if (sd == null || !(pointsPossible > 0)) return null;
  const t = Number(threshold) || 0;
  const ratio = sd / pointsPossible;
  if (t <= 0 || ratio < t) return 'normal';
  return ratio < 2 * t ? 'warn' : 'high';
}

/**
 * Suggested participation penalty (in assignment points) for one student.
 * Nobody with zero assigned reviews is ever penalized. A discarded (careless)
 * review never counts as done.
 *  - all-or-nothing (legacy default): full points when no review counts as
 *    done, or when any review was discarded (an explicit professor judgment).
 *  - proportional: points × (not done ÷ assigned).
 * With `requireComment`, a review only counts as done if it also has a comment.
 */
export function suggestPenalty(participation, { mode = PENALTY_MODES.ALL_OR_NOTHING, points = 0, requireComment = true } = {}) {
  const { assigned, completed, completedWithComment, discarded = 0 } = participation;
  const pts = Number(points) || 0;
  if (!assigned || pts <= 0) return 0;
  const done = requireComment ? completedWithComment : completed;
  if (mode === PENALTY_MODES.PROPORTIONAL) {
    return round2((pts * (assigned - done)) / assigned);
  }
  return done === 0 || discarded > 0 ? round2(pts) : 0;
}

/** max(0, suggested − penalty), or null when there's nothing to suggest. */
export function computeFinalGrade(suggested, penalty = 0) {
  if (suggested == null) return null;
  return round2(Math.max(0, suggested - (Number(penalty) || 0)));
}

/**
 * Validates the final-grade field. Empty is valid (it's just never sent —
 * an empty posted_grade erases the Canvas grade).
 */
export function validateGrade(value, maxPoints) {
  if (value === '' || value == null) return { empty: true, valid: true };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return { empty: false, valid: false, error: 'Nota inválida.' };
  if (maxPoints != null && n > maxPoints) {
    return { empty: false, valid: false, error: `A nota máxima é ${maxPoints}.` };
  }
  return { empty: false, valid: true };
}

export function formatPoints(value) {
  if (value == null || value === '') return '—';
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/**
 * The text_comment sent with the grade: the row's own comment, a note about
 * this student's discarded reviews (if any) and, when the row's penalty is on,
 * the penalty text and the points deducted.
 * Returns '' when there's nothing to say (the comment is then omitted).
 */
export function buildPeerGradeComment({
  comment,
  penaltyOn,
  penaltyPoints,
  penaltyText,
  discardedCount = 0,
  discardedText = '',
}) {
  const parts = [];
  if (trimmed(comment)) parts.push(trimmed(comment));
  if (discardedCount > 0) {
    const label = trimmed(discardedText) || 'Avaliação desconsiderada por falta de justificativa';
    parts.push(`${label} (${discardedCount} ${discardedCount === 1 ? 'avaliação' : 'avaliações'})`);
  }
  const pts = Number(penaltyPoints) || 0;
  if (penaltyOn && pts > 0) {
    const label = trimmed(penaltyText) || 'Penalidade por falta de participação na avaliação por pares';
    parts.push(`${label} (−${formatPoints(pts)} pts)`);
  }
  return parts.join('\n\n');
}
