'use client';

import ContextBanner from './ContextBanner';
import ActiveWorkspaceCourseBanner from './ActiveWorkspaceCourseBanner';
import CourseWorkspaceTabs from './CourseWorkspaceTabs';
import { useCourseQuery } from '@/lib/query/canvasQueries';
import { courseUrl } from '@/lib/canvasLinks';

// Corpo de /courses/[courseId] (ADR-0016). Nome e código do curso vêm do
// cache de consultas — da lista de cursos, quando já carregada, ou de
// GET /api/canvas/courses/[id] —, então a página aparece sem esperar o Canvas.
// As abas só montam com o curso resolvido: as Anotações são chaveadas pelo
// course_code.
export default function CoursePageContent({ courseId, baseUrl, initialTab }) {
  const { course, loading, error } = useCourseQuery(courseId);

  if (!course) {
    return (
      <>
        <h1>Curso</h1>
        {loading ? (
          <p className="lede">Carregando curso…</p>
        ) : (
          <p className="alert alert-error" role="alert">
            {error || 'Não foi possível carregar este curso.'}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <h1>{course.name}</h1>
      <ContextBanner
        items={[
          {
            label: 'Curso',
            value: course.course_code || course.name,
            link: { href: courseUrl(baseUrl, courseId), title: 'Abrir curso no Canvas' },
          },
        ]}
      />

      <ActiveWorkspaceCourseBanner courseId={courseId} />

      <CourseWorkspaceTabs courseId={courseId} courseCode={course.course_code} initialTab={initialTab} />
    </>
  );
}
