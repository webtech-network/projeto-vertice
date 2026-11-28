'use client';

import Link from 'next/link';
import { Presentation, ShieldAlert } from 'lucide-react';
import { useViewRole } from './ViewRoleProvider';

export default function TeacherOnlyGuard({ courseId, children }) {
  const { isStudentView, canSwitchRole, setViewRole } = useViewRole();

  if (!isStudentView) {
    return children;
  }

  return (
    <main className="page">
      <div className="empty-state" style={{ padding: '2.5rem 1.5rem' }}>
        <ShieldAlert size={32} strokeWidth={1.6} aria-hidden="true" style={{ color: 'var(--warn)', marginBottom: '0.75rem' }} />
        <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Área exclusiva da Visão Professor</h1>
        <p className="lede" style={{ maxWidth: '42ch', margin: '0 auto 1.25rem' }}>
          Esta ferramenta é destinada ao gerenciamento docente (correção, importação de questões ou avaliação por pares).
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {canSwitchRole && (
            <button type="button" className="btn btn-primary" onClick={() => setViewRole('teacher')}>
              <Presentation size={16} strokeWidth={1.8} aria-hidden="true" />
              Alternar para Visão Professor
            </button>
          )}
          <Link href={courseId ? `/courses/${courseId}?tab=atividades` : '/courses'} className="btn btn-secondary">
            Voltar ao curso
          </Link>
        </div>
      </div>
    </main>
  );
}
