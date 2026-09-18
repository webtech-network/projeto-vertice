---
title: CLI de importação de questões
status: implemented
domain: cli
updated: 2026-09-17
---

# CLI de importação de questões

> A ferramenta original de linha de comando (`npm run cli -- <file.json>`), que importa um
> arquivo de questões num quiz do Canvas usando **token pessoal fixo do `.env`** — sem relação
> com o OAuth do web.

## Comportamento

- `npm run cli -- <file.json>`: valida (`validateStructural` bloqueante + avisos de schema),
  prompt de confirmação, `--dry-run`, saída colorida, import via `createQuestion`.
- Auth: `CANVAS_API_URL` (inclui `/api/v1`) + `CANVAS_API_TOKEN` (personal access token,
  sem expiração, sem refresh), lidos via `dotenv`. Ver os "dois modelos de auth" em
  [canvas-integration.md](../platform/canvas-integration.md).
- Compartilha código com o web: `canvasClient.js`, `quizValidation.js`, `quiz.schema.json`,
  `shared.js`. Roda direto com `node` (sem bundler) — por isso importa o schema com
  `import ... with { type: 'json' }`.

## Arquivos-chave

- `tools/CanvasQuiz/` (pasta **não renomeada** para evitar mudança de path disruptiva) ·
  script apontado por `"cli"` no [package.json](package.json).

## Contratos

- [canvas-api.md](../contracts/canvas-api.md) (`createClient` com token fixo, `createQuestion`) ·
  [quiz-schema.md](../contracts/quiz-schema.md) · [validation-model.md](../platform/validation-model.md).

## Invariantes e gotchas

- `normalizeBaseUrl()` aceita tanto `CANVAS_API_URL` (`.../api/v1`) quanto `CANVAS_DOMAIN`
  (domínio puro) — o `canvasClient` é agnóstico ao modelo de auth.
- `tools/CanvasQuiz/ct/` é uma pasta de referência **órfã** (Express/jQuery, não usada pelo
  CLI nem pelo web); não confundir com o CLI real.

## Dependências

- [quiz-import.md](quiz-import.md) · [canvas-integration.md](../platform/canvas-integration.md)
