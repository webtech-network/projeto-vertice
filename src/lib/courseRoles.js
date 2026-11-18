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
