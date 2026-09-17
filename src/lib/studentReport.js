// Shared by StudentReport.jsx's table bars and StudentEngagementDashboard.jsx's
// gauges — same "how does this student compare" visual language in both
// places, so the color/average logic lives in one spot instead of two
// slightly-diverging copies.
export function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Grade-quality cutoffs (0-100 scale) — heuristic, not a Canvas concept —
// used for both score gauges/bars (currentScore/finalScore) and the
// "atividades entregues" delivery-rate gauge, since both are "higher is
// better, out of 100" values.
export function scoreColor(score) {
  if (score == null) return 'var(--ink-soft)';
  if (score >= 70) return 'var(--ok)';
  if (score >= 40) return 'var(--warn)';
  return 'var(--err)';
}

// Linear-interpolation quartiles (the same method spreadsheet tools default
// to) — used for StudentReport.jsx's "Tempo de atividade" column instead of
// a fixed 0-100 scale like scoreColor, since activity time has no natural
// ceiling and real course data is often long-tailed (one student logged in
// for 40h skews a plain value/max bar for everyone else). The quartile
// *values* are robust to that — a single extreme value barely moves q1/q2/q3
// — but the *scale* the bar is drawn against must also be robust (see
// robustScaleMax below); otherwise the raw max still flattens everyone.
export function quartiles(values) {
  const sorted = values.filter((v) => v != null).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return { q1: 0, q2: 0, q3: 0 };
  const percentile = (p) => {
    const idx = (n - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
  };
  return { q1: percentile(0.25), q2: percentile(0.5), q3: percentile(0.75) };
}

// Scale ceiling for long-tailed values (activity time, page views) that a
// value/max bar would otherwise let a single outlier dominate. Uses Tukey's
// upper fence (q3 + 1.5×IQR): values beyond it are treated as outliers and
// simply render at full width/needle, while the rest of the class keeps a
// readable spread. When there's no spread to protect (IQR = 0 — everyone
// tied, or a big cluster at zero with a lone outlier), the fence collapses
// to the cluster value and the raw max is the only honest scale, so it falls
// back to that rather than returning 0 and hiding every bar.
export function robustScaleMax(values) {
  const nonNull = values.filter((v) => v != null);
  if (nonNull.length === 0) return 0;
  const { q1, q3 } = quartiles(nonNull);
  const iqr = q3 - q1;
  if (iqr === 0) return Math.max(...nonNull);
  return Math.min(Math.max(...nonNull), q3 + 1.5 * iqr);
}

// Bottom quartile (at/below Q1) flagged as attention, second quartile
// (Q1-Q2) as warn, at/above the median as ok — same 3-color status
// vocabulary as scoreColor (this app has no 4th "great" token), bucketed by
// the class's own quartiles instead of a fixed scale.
export function quartileColor(value, { q1, q2 }) {
  if (value == null) return 'var(--ink-soft)';
  if (value <= q1) return 'var(--err)';
  if (value <= q2) return 'var(--warn)';
  return 'var(--ok)';
}

export const ENROLLMENT_STATE_LABELS = {
  active: 'Ativa',
  invited: 'Convidada',
  rejected: 'Rejeitada',
  completed: 'Concluída',
  inactive: 'Inativa',
};

// A user can carry more than one enrollment in the same course (rare, but
// possible with multiple sections, or a re-enrollment after being removed
// and re-added) — the StudentEnrollment one(s) are what the report cares
// about; any other type present is ignored. When more than one
// StudentEnrollment exists, the "best" one wins by this priority order
// (active > invited > completed > inactive) rather than whichever Canvas
// happens to list first — otherwise a student who's genuinely active in one
// section could get masked by a stale/removed enrollment in another,
// showing the wrong status for no reason a professor could see in Canvas's
// own UI (which always surfaces the most relevant enrollment per student).
const ENROLLMENT_STATE_PRIORITY = ['active', 'invited', 'completed', 'inactive'];

function primaryEnrollment(student) {
  const enrollments = student.enrollments || [];
  const studentEnrollments = enrollments.filter((e) => e.type === 'StudentEnrollment');
  if (studentEnrollments.length <= 1) return studentEnrollments[0] || enrollments[0] || null;

  return studentEnrollments.reduce((best, e) => {
    const bestRank = ENROLLMENT_STATE_PRIORITY.indexOf(best.enrollment_state);
    const rank = ENROLLMENT_STATE_PRIORITY.indexOf(e.enrollment_state);
    return rank !== -1 && (bestRank === -1 || rank < bestRank) ? e : best;
  });
}

/**
 * Flattens Canvas's nested user+enrollment shape into one row per student for
 * the report table.
 */
export function buildStudentRows(students) {
  return students.map((student) => {
    const enrollment = primaryEnrollment(student);
    const email = student.email || null;
    return {
      id: student.id,
      name: student.name,
      sortableName: student.sortable_name || student.name,
      contact: email || student.login_id || '—',
      contactIsLogin: !email && Boolean(student.login_id),
      enrollmentState: enrollment?.enrollment_state || null,
      lastActivityAt: enrollment?.last_activity_at || null,
      totalActivityTime: enrollment?.total_activity_time ?? null,
      currentScore: enrollment?.grades?.current_score ?? null,
      currentGrade: enrollment?.grades?.current_grade ?? null,
      finalScore: enrollment?.grades?.final_score ?? null,
      finalGrade: enrollment?.grades?.final_grade ?? null,
    };
  });
}
