import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

// One record per course, keyed by the course's `course_code` (not its
// numeric Canvas id) — per product decision, so a note travels with the
// human-readable code a professor recognizes rather than an opaque id.
function toApp(row) {
  if (!row) return null;
  return {
    courseCode: row.course_code,
    courseId: row.course_id,
    text: row.text,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function listCourseNotes() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from('course_notes').select('*');
  if (error) throw error;
  return data.map(toApp);
}

export async function getCourseNote(courseCode) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('course_notes')
    .select('*')
    .eq('course_code', courseCode)
    .maybeSingle();
  if (error) throw error;
  return toApp(data);
}

export async function saveCourseNoteLocal(courseCode, { courseId, text }) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('course_notes')
    .upsert({ course_code: courseCode, course_id: courseId ?? null, text }, { onConflict: 'user_id,course_code' })
    .select()
    .single();
  if (error) throw error;
  return toApp(data);
}
