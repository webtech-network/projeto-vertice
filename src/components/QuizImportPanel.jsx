'use client';

import { useState } from 'react';
import { Upload, Sparkles } from 'lucide-react';
import ImportQuestions from './ImportQuestions';
import QuestionGenerator from './QuestionGenerator';

// Lets the professor choose where the imported questions come from for this
// specific quiz — an uploaded .json file (today's original flow) or a fresh
// AI generation targeting this course/quiz directly. Styled as folder-style
// tabs (rather than a compact segmented toggle) with a one-line description
// per option, so the two sources read as genuinely different paths rather
// than just two button states.
const TABS = [
  {
    key: 'file',
    label: 'Enviar arquivo',
    description: 'Importe um arquivo .json já pronto, gerado anteriormente.',
    Icon: Upload,
  },
  {
    key: 'ai',
    label: 'Gerar com IA',
    description: 'Crie novas questões com inteligência artificial, já vinculadas a esta atividade.',
    Icon: Sparkles,
  },
];

export default function QuizImportPanel({ courseId, quizId, integrations }) {
  const [mode, setMode] = useState('file');
  const active = TABS.find((tab) => tab.key === mode);

  return (
    <div className="quiz-import-panel">
      <div className="tab-folder" role="tablist" aria-label="Origem das questões">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            className={`tab-folder-btn${mode === key ? ' active' : ''}`}
            onClick={() => setMode(key)}
          >
            <Icon size={16} strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>

      <div className="tab-folder-panel" role="tabpanel">
        <p className="tab-folder-description">{active.description}</p>

        {mode === 'file' ? (
          <ImportQuestions courseId={courseId} quizId={quizId} />
        ) : (
          <QuestionGenerator integrations={integrations} courseId={courseId} quizId={quizId} />
        )}
      </div>
    </div>
  );
}
