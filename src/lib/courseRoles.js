// Papéis do usuário num curso do Canvas (`enrollment_type`), em ordem de
// precedência para o papel "principal" quando há mais de um no mesmo curso.
// Sem dependências de servidor: usado tanto por canvasClient quanto pela UI.
export const COURSE_ROLES = ['teacher', 'ta', 'designer', 'student', 'observer'];

export const COURSE_ROLE_LABELS = {
  teacher: 'Professor',
  ta: 'Tutor',
  designer: 'Designer',
  student: 'Aluno',
  observer: 'Observador',
};

// Papéis de visão do aplicativo (Professor vs. Aluno), derivados das
// matrículas do Canvas (/users/self/enrollments) no login OAuth (ADR-0027).
export const APP_VIEW_ROLES = ['teacher', 'student'];

export const APP_VIEW_ROLE_LABELS = {
  teacher: 'Professor',
  student: 'Aluno',
};

const TEACHER_ENROLLMENT_TYPES = new Set([
  'TeacherEnrollment',
  'TaEnrollment',
  'DesignerEnrollment',
]);

const STUDENT_ENROLLMENT_TYPES = new Set([
  'StudentEnrollment',
  'ObserverEnrollment',
]);

export function deriveAppRolesFromEnrollments(enrollments = []) {
  const roles = new Set();
  for (const enrollment of enrollments) {
    if (TEACHER_ENROLLMENT_TYPES.has(enrollment?.type)) {
      roles.add('teacher');
    } else if (STUDENT_ENROLLMENT_TYPES.has(enrollment?.type)) {
      roles.add('student');
    }
  }
  const ordered = APP_VIEW_ROLES.filter((role) => roles.has(role));
  return {
    roles: ordered,
    primaryRole: ordered[0] ?? null,
  };
}
