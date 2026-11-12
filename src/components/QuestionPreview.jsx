'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MULTIPLE_CHOICE, QUESTION_TYPE_LABELS, questionTypeOf } from '@/lib/quizValidation';

// Full-fidelity preview of one question, as the student will see it in Canvas.
// The question's HTML comes from an uploaded file or from an AI — never
// injected into the app's DOM. It lives in its own document inside a
// sandboxed iframe WITHOUT allow-scripts (ADR-0020): `allow-same-origin` is
// there only so this component can read the document height and size the
// iframe to fit. The sheet is always light, like Canvas — question HTML
// carries inline styles written for a white page.

const SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox';
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https: data:";

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPoints(value) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

const SHEET_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; background: #ffffff; color: #1c2333; }
  body { font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 18px 20px; overflow-wrap: anywhere; }
  img, video { max-width: 100%; height: auto; }
  pre { white-space: pre; overflow-x: auto; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  table { border-collapse: collapse; max-width: 100%; }
  .q-body > :first-child { margin-top: 0; }
  .q-section { margin-top: 18px; padding-top: 14px; border-top: 1px solid #d7e3ef; }
  .q-label { margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #4a5268; }
  .q-answers { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .q-answer { border: 1px solid #d7e3ef; border-radius: 8px; padding: 10px 12px; }
  .q-answer.is-correct { border-color: #2f6b4f; background: #e8f3ec; }
  .q-answer-head { display: flex; gap: 8px; align-items: baseline; }
  .q-letter { flex: none; font-weight: 700; }
  .q-tag { margin-left: auto; flex: none; font-size: 12px; font-weight: 700; color: #2f6b4f; }
  .q-comment { margin-top: 6px; padding-left: 22px; font-size: 13.5px; color: #4a5268; }
  .q-comment > :first-child { margin-top: 0; }
  .q-comment > :last-child { margin-bottom: 0; }
  .q-empty { color: #8a6417; font-style: italic; }
`;

function buildDocument(question) {
  const type = questionTypeOf(question);
  const parts = [`<div class="q-body">${question.question_text || '<p class="q-empty">Sem enunciado.</p>'}</div>`];

  if (type === MULTIPLE_CHOICE) {
    const answers = (question.answers || [])
      .map((a, i) => {
        const letter = String.fromCharCode(65 + i);
        const comment = a.answer_comment ? `<div class="q-comment">${a.answer_comment}</div>` : '';
        return `<li class="q-answer${a.is_correct ? ' is-correct' : ''}">
          <div class="q-answer-head"><span class="q-letter">${letter})</span><span>${escapeHtml(a.answer_text)}</span>${
            a.is_correct ? '<span class="q-tag">✓ Correta</span>' : ''
          }</div>${comment}</li>`;
      })
      .join('');
    parts.push(`<div class="q-section"><p class="q-label">Alternativas e comentários</p><ol class="q-answers">${answers}</ol></div>`);
  }

  if (question.feedback_comment) {
    const label = type === 'essay_question' ? 'Padrão de resposta (comentário geral)' : 'Comentário geral';
    parts.push(`<div class="q-section"><p class="q-label">${label}</p>${question.feedback_comment}</div>`);
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<base target="_blank"><style>${SHEET_CSS}</style></head><body>${parts.join('')}</body></html>`;
}

export default function QuestionPreview({ question, id, selected, onToggleSelected }) {
  const frameRef = useRef(null);
  const [height, setHeight] = useState(160);
  const srcDoc = useMemo(() => buildDocument(question), [question]);
  const type = questionTypeOf(question);

  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.documentElement) setHeight(Math.ceil(doc.documentElement.scrollHeight) + 2);
  }, []);

  // Width changes reflow the text (and so the height) — re-measure on resize.
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const points = type === 'text_only_question' ? 0 : (question.points_possible ?? 1);

  return (
    <div className="question-preview-panel" id={id}>
      <div className="question-preview-meta">
        <span className="badge">{QUESTION_TYPE_LABELS[type] || type}</span>
        {question.question_model && <span className="badge">{question.question_model}</span>}
        <span className="badge">
          {formatPoints(points)} {points === 1 ? 'ponto' : 'pontos'}
        </span>
        <label className="question-preview-select">
          <input type="checkbox" checked={selected} onChange={onToggleSelected} />
          Importar esta questão
        </label>
      </div>
      <iframe
        ref={frameRef}
        className="question-preview-frame"
        title={`Pré-visualização: ${question.question_name || 'questão'}`}
        sandbox={SANDBOX}
        srcDoc={srcDoc}
        onLoad={measure}
        style={{ height }}
      />
    </div>
  );
}
