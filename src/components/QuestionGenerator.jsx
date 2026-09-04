'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import QuizReviewImport from './QuizReviewImport';
import { getCustomPrompt } from '@/lib/customPrompts';

const NIVEL_OPTIONS = [
  { value: 'baixo', label: 'Baixo' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'alto', label: 'Alto' },
];

const TIPO_OPTIONS = [
  { value: 'RU', label: 'RU — Resposta Única' },
  { value: 'CM', label: 'CM — Complementação Múltipla' },
  { value: 'AR', label: 'AR — Asserção-Razão' },
];

function emptySpec() {
  return { quantidade: 1, tema: '', nivel: 'intermediario', tipo: 'RU' };
}

// Preview-only: strips HTML tags down to plain text via the browser's own HTML
// parser (never executes scripts). The saved JSON file keeps the real HTML —
// this app has no sanitization tooling, so raw HTML from generated content is
// never injected into the DOM.
function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

export default function QuestionGenerator({ integrations, courseId, quizId }) {
  const [integrationId, setIntegrationId] = useState(
    integrations.find((i) => i.isDefault)?.id || integrations[0]?.id || '',
  );
  const [specs, setSpecs] = useState([emptySpec()]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [skillInfoOpen, setSkillInfoOpen] = useState(false);
  // Bumped on every successful generation so <QuizReviewImport> remounts
  // (via its key) instead of keeping stale selection/results from a
  // previous batch of generated questions.
  const [generationId, setGenerationId] = useState(0);

  const canReviewInline = Boolean(courseId && quizId);

  function updateSpec(index, field, value) {
    setSpecs((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function addSpec() {
    setSpecs((prev) => [...prev, emptySpec()]);
  }

  function removeSpec(index) {
    setSpecs((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    setQuiz(null);
    setWarnings([]);
    setReviewing(false);

    try {
      const custom = await getCustomPrompt('generateQuestions');
      const response = await fetch(`/api/ai/integrations/${integrationId}/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specs, customPromptText: custom?.text, customPromptMode: custom?.mode }),
      });
      const data = await response.json();
      if (!response.ok) {
        setGenerateError(data.error || 'Falha ao gerar questões.');
      } else {
        setQuiz(data.quiz);
        setWarnings(data.warnings || []);
        setGenerationId((n) => n + 1);
      }
    } catch (err) {
      setGenerateError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function handleSaveFile() {
    if (!quiz) return;
    const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questoes-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const specsValid = specs.length > 0 && specs.every((s) => s.tema.trim() && Number(s.quantidade) >= 1);
  const totalQuestions = specs.reduce((sum, s) => sum + (Number(s.quantidade) || 0), 0);

  return (
    <div className="question-generator">
      <div className="skill-download-card">
        <button
          type="button"
          className="alert-toggle skill-download-toggle"
          aria-expanded={skillInfoOpen}
          onClick={() => setSkillInfoOpen((v) => !v)}
        >
          {skillInfoOpen ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
          Gerar com a skill no Claude Desktop (alternativa sem chave de API)
        </button>
        {skillInfoOpen && (
          <>
            <p className="lede">
              Prefere usar sua própria conta do Claude Desktop em vez de cadastrar uma chave de API aqui? Baixe a
              mesma skill de geração de questões usada por este projeto, instale-a no Claude Desktop e gere o JSON
              de questões por lá — depois é só importar o arquivo normalmente.
            </p>
            <ol className="skill-download-steps">
              <li>
                Baixe o arquivo <code>enade-it-questions.skill</code> no botão abaixo.
              </li>
              <li>
                No Claude Desktop, importe o arquivo baixado como uma nova Skill (em Configurações, na seção de
                Skills / Capacidades — o nome exato pode variar conforme a versão do Claude Desktop).
              </li>
              <li>
                Inicie uma conversa e peça a geração das questões, informando tema, nível
                (baixo/intermediário/alto) e tipo (RU, CM ou AR) desejados para cada questão.
              </li>
              <li>
                Salve o JSON retornado pelo Claude e importe-o em &quot;Enviar arquivo&quot;, na tela de importação
                da atividade de destino.
              </li>
            </ol>
            <a
              href="/api/skills/enade-it-questions"
              download="enade-it-questions.skill"
              className="btn btn-secondary btn-sm"
            >
              Baixar skill (enade-it-questions.skill)
            </a>
          </>
        )}
      </div>

      {integrations.length === 0 ? (
        <div className="alert alert-warning">
          Configure ao menos uma integração de IA em <Link href="/perfil">seu perfil</Link> para gerar questões.
        </div>
      ) : (
        <>
          {integrations.length > 1 && (
            <div className="provider-select">
              <label htmlFor="ai-integration">Integração de IA</label>
              <select id="ai-integration" value={integrationId} onChange={(e) => setIntegrationId(e.target.value)}>
                {integrations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} — {i.providerLabel} ({i.model})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="spec-table-wrap">
          <div className="spec-list-header">
            <span>Num. de Questões</span>
            <span>Tema</span>
            <span>Complexidade</span>
            <span>Tipo de Questão</span>
          </div>
          <div className="spec-list">
            {specs.map((spec, i) => (
              <div key={i} className="spec-row">
                <input
                  type="number"
                  min="1"
                  step="1"
                  aria-label="Número de questões"
                  value={spec.quantidade}
                  onChange={(e) => updateSpec(i, 'quantidade', Number(e.target.value))}
                />
                <input
                  type="text"
                  placeholder="Tema (ex.: Normalização de banco de dados)"
                  value={spec.tema}
                  onChange={(e) => updateSpec(i, 'tema', e.target.value)}
                />
                <select value={spec.nivel} onChange={(e) => updateSpec(i, 'nivel', e.target.value)}>
                  {NIVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select value={spec.tipo} onChange={(e) => updateSpec(i, 'tipo', e.target.value)}>
                  {TIPO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={specs.length === 1}
                  onClick={() => removeSpec(i)}
                  aria-label="Remover questão"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
          </div>

          <button type="button" className="btn btn-secondary btn-sm" onClick={addSpec}>
            + Adicionar questão
          </button>

          <div className="generate-actions">
            <button type="button" className="btn btn-primary" disabled={!specsValid || generating} onClick={handleGenerate}>
              {generating ? 'Gerando…' : `Gerar questões (${totalQuestions})`}
            </button>
            {generating && <span className="lede">Gerando… pode levar até um minuto.</span>}
          </div>
        </>
      )}

      {generateError && <div className="alert alert-error">{generateError}</div>}

      {quiz && (
        <div className="quiz-preview">
          {reviewing ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReviewing(false)}>
                <ArrowLeft size={14} strokeWidth={2} />
                Voltar
              </button>
              <QuizReviewImport key={generationId} courseId={courseId} quizId={quizId} quiz={quiz} warnings={warnings} />
            </>
          ) : (
            <>
              <div className="alert alert-warning">
                {canReviewInline ? (
                  <>
                    Ao importar diretamente, o curso/quiz de destino é aplicado automaticamente. Se preferir salvar o
                    arquivo para usar depois em outra atividade, os campos course_id/quiz_id ficarão como{' '}
                    <code>0</code> (placeholders) até o envio manual.
                  </>
                ) : (
                  <>
                    course_id/quiz_id vêm como <code>0</code> (placeholders) — o curso/quiz real é definido no fluxo
                    de importação, ao enviar este arquivo.
                  </>
                )}
              </div>

              {warnings.length > 0 && (
                <div className="alert alert-warning">
                  <button type="button" className="alert-toggle" onClick={() => setWarningsOpen((v) => !v)}>
                    {warningsOpen ? (
                      <ChevronDown size={14} strokeWidth={2} />
                    ) : (
                      <ChevronRight size={14} strokeWidth={2} />
                    )}
                    {warnings.length} aviso(s) de formatação (não impedem o uso)
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

              {quiz.questions.map((q, i) => (
                <article key={i} className="page question-preview">
                  <h3>{q.question_name}</h3>
                  <p>{stripHtml(q.question_text)}</p>
                  <ul>
                    {(q.answers || []).map((a, j) => (
                      <li key={j}>
                        {a.is_correct ? <strong>[Correta] </strong> : null}
                        {a.answer_text}
                        {a.answer_comment && <div className="lede">{stripHtml(a.answer_comment)}</div>}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}

              <div className="generate-actions">
                <button type="button" className="btn btn-primary" onClick={handleSaveFile}>
                  Salvar arquivo
                </button>
                {canReviewInline && (
                  <button type="button" className="btn btn-secondary" onClick={() => setReviewing(true)}>
                    Revisar e importar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
