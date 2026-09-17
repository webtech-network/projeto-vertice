import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

// Same mapping convention as courseNotesRepo.js/uiPreferences.js.
export function toApp(row) {
  if (!row) return null;
  return {
    id: row.id,
    courseId: row.course_id,
    studentId: row.student_id,
    snapshotDate: row.snapshot_date,
    computedAt: new Date(row.computed_at).getTime(),
    score: row.score,
    riskLevel: row.risk_level,
    coverage: row.coverage,
    dimensions: row.dimensions,
    weightsUsed: row.weights_used,
    quartiles: row.quartiles,
  };
}

/**
 * Bulk upsert, one row per analyzed student — `user_id`/`snapshot_date`
 * are left out of the payload (DB defaults: auth.uid()/current_date) but
 * still participate in the conflict target, since Postgres applies column
 * defaults before evaluating ON CONFLICT. Running "Analisar situação dos alunos"
 * again the same day updates that day's row instead of duplicating it (see
 * the `unique` constraint on student_engagement_snapshots).
 */
export async function saveEngagementSnapshots(courseId, snapshots) {
  if (!snapshots.length) return;
  const supabase = createSupabaseBrowserClient();
  const rows = snapshots.map((s) => ({
    course_id: courseId,
    student_id: s.studentId,
    score: s.score,
    risk_level: s.riskLevel,
    coverage: s.coverage,
    dimensions: s.dimensions,
    weights_used: s.weightsUsed,
    quartiles: s.quartiles,
  }));
  const { error } = await supabase
    .from('student_engagement_snapshots')
    .upsert(rows, { onConflict: 'user_id,course_id,student_id,snapshot_date' });
  if (error) throw error;
}

// Chronological (oldest first) — ready to feed straight into a line chart.
export async function listEngagementHistory(courseId, studentId, { limit = 20 } = {}) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('student_engagement_snapshots')
    .select('*')
    .eq('course_id', courseId)
    .eq('student_id', studentId)
    .order('snapshot_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map(toApp).reverse();
}

/**
 * Latest score per student strictly before today — feeds the ▲/▼/– trend
 * arrow next to each row's risk pill, comparing today's just-computed score
 * against the last time that student was checked. Returns a plain
 * Map<studentId, score>.
 */
export async function listPreviousSnapshotsForCourse(courseId) {
  const supabase = createSupabaseBrowserClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('student_engagement_snapshots')
    .select('student_id, score, snapshot_date')
    .eq('course_id', courseId)
    .lt('snapshot_date', today)
    .order('snapshot_date', { ascending: false });
  if (error) throw error;

  const latestByStudent = new Map();
  for (const row of data) {
    if (!latestByStudent.has(row.student_id)) latestByStudent.set(row.student_id, row.score);
  }
  return latestByStudent;
}
