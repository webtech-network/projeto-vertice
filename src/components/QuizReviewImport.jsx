'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CircleCheck, CircleX } from 'lucide-react';
import { MULTIPLE_CHOICE, QUESTION_TYPE_LABELS, questionTypeOf } from '@/lib/quizValidation';
import QuestionPreview from './QuestionPreview';

const COLUMN_COUNT = 6;
const EXCERPT_LENGTH = 220;

// Plain-text excerpt for the table row — the browser's HTML parser strips the
// tags without executing anything; the full HTML only renders inside
// QuestionPreview's sandboxed iframe (ADR-0020).
function excerptOf(html) {
  if (!html || typeof window === 'undefined') return '';
  // A space before each block-level tag keeps paragraphs/items from gluing
  // together once the tags are gone ("…minutos)Questões" → "…minutos) Questões").
  const spaced = html.replace(/<(?=\/?(?:p|li|div|br|h[1-6]|tr|td|th|pre|ul|ol|table|blockquote)\b)/gi, ' <');
  const text = (new DOMParser().parseFromString(spaced, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH).trimEnd()}…` : text;
}

// Shared review/select/import table — fed either by ImportQuestions.jsx
// (file upload) or by QuestionGenerator.jsx (AI generation, already
// structurally validated server-side, no re-validation needed here).
// Callers must remount this component (via a changing `key`) whenever
// `quiz` is swapped for a genuinely different batch — this component does
// not reset its own selection/results state on prop changes.
export default function QuizReviewImport({ courseId, quizId, quiz, warnings }) {
  const [selected, setSelected] = useState(() => quiz.questions.map(() => true));
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const excerpts = useMemo(() => quiz.questions.map((q) => excerptOf(q.question_text)), [quiz]);
  const allExpanded = quiz.questions.length > 0 && expanded.size === quiz.questions.length;

  function toggleExpanded(index) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleExpandAll() {
    setExpanded(allExpanded ? new Set() : new Set(quiz.questions.map((_, i) => i)));
  }

  const allSelected = selected.length > 0 && selected.every(Boolean);
  const selectedCount = selected.filter(Boolean).length;

  function toggleAll() {
    setSelected((prev) => prev.map(() => !allSelected));
  }

  function toggleOne(index) {
    setSelected((prev) => prev.map((value, i) => (i === index ? !value : value)));
  }

  async function handleImport() {
    const selectedQuestions = quiz.questions.filter((_, i) => selected[i]);
    if (selectedQuestions.length === 0) return;

    setImporting(true);
    setSubmitError(null);
    setResults(null);

    try {
      const response = await fetch('/api/canvas/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, quizId, questions: selectedQuestions }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSubmitError(data.error || 'Falha ao importar as questões.');
      } else {
        setResults(data.results);
      }
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="quiz-review-import">
      {warnings.length > 0 && (
        <div className="alert alert-warning">
          <button type="button" className="alert-toggle" onClick={() => setWarningsOpen((v) => !v)}>
            {warningsOpen ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
            {warnings.length} aviso(s) de formatação (não impedem a importação)
          </button>
          {warningsOpen && (
            <ul>
              {warnings.map((message, i) => (
                <li key={i}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="quiz-review-toolbar">
        <span className="quiz-review-hint">Clique no título de uma questão para revisá-la como o aluno verá no Canvas.</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggleExpandAll}>
          {allExpanded ? 'Recolher todas' : 'Expandir todas'}
        </button>
      </div>

      <div className="data-table-wrap">
      <table className="data-table quiz-review-table">
        <thead>
          <tr>
            <th>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Selecionar todas" />
            </th>
            <th>Questão</th>
            <th>Tipo</th>
            <th>Modelo</th>
            <th>Pontos</th>
            <th>Alternativas</th>
          </tr>
        </thead>
        <tbody>
          {quiz.questions.map((q, i) => {
            const isOpen = expanded.has(i);
            const type = questionTypeOf(q);
            const panelId = `question-preview-${i}`;
            return (
              <Fragment key={i}>
                <tr className={isOpen ? 'is-expanded' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(selected[i])}
                      onChange={() => toggleOne(i)}
                      aria-label={`Selecionar ${q.question_name}`}
                    />
                  </td>
                  <td className="quiz-review-question-cell">
                    <button
                      type="button"
                      className="quiz-review-title-btn"
                      onClick={() => toggleExpanded(i)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                    >
                      <span className={`group-chevron${isOpen ? ' expanded' : ''}`} aria-hidden="true">
                        <ChevronRight size={16} strokeWidth={2} />
                      </span>
                      <span className="quiz-review-title">{q.question_name}</span>
                    </button>
                    {excerpts[i] && <p className="quiz-review-excerpt">{excerpts[i]}</p>}
                  </td>
                  <td>{QUESTION_TYPE_LABELS[type] || type}</td>
                  <td>{q.question_model || '—'}</td>
                  <td>{type === 'text_only_question' ? 0 : (q.points_possible ?? 1)}</td>
                  <td>{type === MULTIPLE_CHOICE ? (q.answers || []).length : '—'}</td>
                </tr>
                {isOpen && (
                  <tr className="quiz-review-detail-row">
                    <td colSpan={COLUMN_COUNT}>
                      <QuestionPreview
                        id={panelId}
                        question={q}
                        selected={Boolean(selected[i])}
                        onToggleSelected={() => toggleOne(i)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        disabled={selectedCount === 0 || importing}
        onClick={handleImport}
      >
        {importing ? 'Importando…' : `Importar selecionadas (${selectedCount})`}
      </button>

      {submitError && <div className="alert alert-error">{submitError}</div>}

      {results && (
        <div className="import-results">
          <h2>Resultado da importação</h2>
          <ul>
            {results.map((r) => (
              <li key={r.index} className={r.success ? 'result-ok' : 'result-fail'}>
                {r.success ? (
                  <>
                    <CircleCheck size={14} strokeWidth={2} />
                    {r.name} — ID no Canvas: {r.canvasId}
                  </>
                ) : (
                  <>
                    <CircleX size={14} strokeWidth={2} />
                    {r.name} — {r.error}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
