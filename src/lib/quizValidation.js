// quiz.schema.json declares itself as a 2020-12 schema ($schema:
// ".../draft/2020-12/schema"); ajv's default export only understands
// draft-07, so the 2020-12-aware build is required here.
import Ajv2020 from 'ajv/dist/2020.js';

export const MULTIPLE_CHOICE = 'multiple_choice_question';

/** Question types this tool can post to a classic Canvas quiz (ADR-0019). */
export const QUESTION_TYPES = [MULTIPLE_CHOICE, 'essay_question', 'text_only_question', 'file_upload_question'];

/** Short pt-BR labels for previews (table / CLI). */
export const QUESTION_TYPE_LABELS = {
  multiple_choice_question: 'Múltipla escolha',
  essay_question: 'Dissertativa',
  text_only_question: 'Texto (sem questão)',
  file_upload_question: 'Envio de arquivo',
};

/** `question_type` with the backwards-compatible default (absent = multiple choice). */
export function questionTypeOf(question) {
  return question?.question_type ?? MULTIPLE_CHOICE;
}

/**
 * Cheap, blocking checks — the minimum a file needs to actually be postable to
 * Canvas. Mirrors what the CLI already enforced before this refactor.
 */
export function validateStructural(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['O arquivo não contém um objeto JSON válido.'] };
  }

  if (data.course_id === undefined || data.course_id === null) {
    errors.push("Campo obrigatório ausente: 'course_id'.");
  }
  if (data.quiz_id === undefined || data.quiz_id === null) {
    errors.push("Campo obrigatório ausente: 'quiz_id'.");
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    errors.push("O campo 'questions' deve ser uma lista com ao menos uma questão.");
    return { valid: false, errors };
  }

  data.questions.forEach((q, i) => {
    const label = `Questão ${i + 1}${q && q.question_name ? ` ("${q.question_name}")` : ''}`;

    if (!q || typeof q !== 'object') {
      errors.push(`${label}: não é um objeto válido.`);
      return;
    }
    if (!q.question_name || typeof q.question_name !== 'string') {
      errors.push(`${label}: 'question_name' ausente ou inválido.`);
    }
    if (!q.question_text || typeof q.question_text !== 'string') {
      errors.push(`${label}: 'question_text' ausente ou inválido.`);
    }

    const type = questionTypeOf(q);
    if (!QUESTION_TYPES.includes(type)) {
      errors.push(`${label}: 'question_type' inválido ("${type}"). Use um de: ${QUESTION_TYPES.join(', ')}.`);
      return;
    }
    if (q.points_possible !== undefined && q.points_possible !== null) {
      if (typeof q.points_possible !== 'number' || !Number.isFinite(q.points_possible) || q.points_possible < 0) {
        errors.push(`${label}: 'points_possible' deve ser um número maior ou igual a zero.`);
      }
    }
    // Open types (essay, text-only, file upload) carry no alternatives —
    // Canvas ignores `answers` for them, so it may be absent or empty.
    if (type !== MULTIPLE_CHOICE) {
      if (q.answers !== undefined && !Array.isArray(q.answers)) {
        errors.push(`${label}: 'answers' deve ser uma lista (vazia) em questões do tipo ${type}.`);
      }
      return;
    }

    if (!Array.isArray(q.answers) || q.answers.length < 2) {
      errors.push(`${label}: questão de múltipla escolha precisa de ao menos 2 alternativas em 'answers'.`);
    } else {
      const correctCount = q.answers.filter((a) => a && a.is_correct === true).length;
      if (correctCount !== 1) {
        errors.push(`${label}: deve haver exatamente 1 alternativa correta (encontradas: ${correctCount}).`);
      }
      q.answers.forEach((a, j) => {
        if (!a || typeof a.answer_text !== 'string' || !a.answer_text) {
          errors.push(`${label}, alternativa ${j + 1}: 'answer_text' ausente ou inválido.`);
        }
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Compiles an ajv validator for the given (already-parsed) schema object.
 * Kept schema-agnostic on purpose: Next.js's bundler and the plain-Node CLI
 * need different JSON import syntax, so each call site imports quiz.schema.json
 * itself and passes the parsed object in here.
 */
export function createSchemaValidator(schemaObject) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schemaObject);
  return function checkSchema(data) {
    const valid = validate(data);
    return valid ? [] : summarizeSchemaWarnings(validate.errors || []);
  };
}

/**
 * Turns raw ajv errors into a short, deduplicated, human-readable list.
 * Real question banks routinely deviate from quiz.schema.json (missing
 * question_model, extra fields like `nivel`) without being "wrong" — these
 * are surfaced as warnings, never as blocking errors.
 */
export function summarizeSchemaWarnings(ajvErrors) {
  if (!ajvErrors || ajvErrors.length === 0) return [];

  const missingByProp = new Map();
  const extraByProp = new Map();
  const other = new Set();

  for (const err of ajvErrors) {
    // `if` only says "a then/else branch failed" — the branch's own error is
    // already in the list, so this one is noise for the user.
    if (err.keyword === 'if') continue;
    if (err.keyword === 'required') {
      const prop = err.params?.missingProperty ?? 'desconhecido';
      missingByProp.set(prop, (missingByProp.get(prop) || 0) + 1);
    } else if (err.keyword === 'additionalProperties') {
      const prop = err.params?.additionalProperty ?? 'desconhecido';
      extraByProp.set(prop, (extraByProp.get(prop) || 0) + 1);
    } else {
      const path = err.instancePath || '(raiz)';
      other.add(`${path}: ${err.message}`);
    }
  }

  const warnings = [];
  for (const [prop, count] of missingByProp) {
    warnings.push(`Campo '${prop}' ausente em ${count} local(is) (fora do padrão de quiz.schema.json).`);
  }
  for (const [prop, count] of extraByProp) {
    warnings.push(`Campo '${prop}' não previsto no schema encontrado em ${count} local(is).`);
  }
  warnings.push(...other);
  return warnings;
}

/**
 * Maps this tool's question shape to the payload Canvas's quiz questions
 * endpoint expects. Open types go without `answers`; `points_possible` uses
 * `??` because 0 is legitimate (text-only blocks are always 0).
 */
export function toCanvasPayload(question) {
  const type = questionTypeOf(question);
  const isText = type === 'text_only_question';

  const payload = {
    question_name: question.question_name,
    question_text: question.question_text,
    question_type: type,
    points_possible: isText ? 0 : (question.points_possible ?? 1),
  };

  if (type === MULTIPLE_CHOICE) {
    payload.answers = (question.answers || []).map((ans) => ({
      answer_text: ans.answer_text,
      answer_weight: ans.is_correct ? 100 : 0,
      answer_comment_html: ans.answer_comment || '',
    }));
  }

  if (question.feedback_comment) {
    payload.neutral_comments_html = question.feedback_comment;
  }

  return { question: payload };
}
