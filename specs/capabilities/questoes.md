---
title: Geração de questões (Questões)
status: implemented
domain: ai
updated: 2026-11-12
---

# Geração de questões (Questões)

> `/questoes` gera um JSON de questões (shape de `quiz.schema.json`) com IA, para preview e
> download — independente do Canvas.

## Comportamento

- `questoes/page.jsx` passa a `QuestionGenerator` o resultado de `getConfiguredIntegrations`
  (ativas com chave). Sem nenhuma configurada → alerta linkando `/perfil` (sem o form de specs).
- `QuestionGenerator.jsx`: `<select>` de provedor só aparece com >1 integração; specs por
  questão (tema/nível/tipo — **RU/CM/AR/DISC**; `INT` nunca é oferecido aqui). `DISC`
  (Dissertativa) gera `essay_question` com `answers: []` e `feedback_comment` com resposta
  esperada e critérios de correção ([ADR-0019](../decisions/0019-questoes-abertas.md)); preview em texto
  puro via `DOMParser(...).body.textContent` (**nunca** `dangerouslySetInnerHTML`).
- `course_id`/`quiz_id` sempre `0` (convenção do skill p/ código não definido; nunca `null`).
- O JSON salvo/baixado mantém o HTML **completo** (é o que o Canvas precisa); só o preview
  visual stripas as tags.
- Card "Gerar com a skill no Claude Desktop" (escape hatch, sempre visível) → "Baixar skill"
  (`GET /api/skills/enade-it-questions`, zíper on-demand com `adm-zip` da pasta versionada
  `skills/enade-it-questions/`).

## Arquivos-chave

- [questoes/page.jsx](src/app/(dashboard)/questoes/page.jsx) ·
  [QuestionGenerator.jsx](src/components/QuestionGenerator.jsx) ·
  `src/app/api/skills/enade-it-questions/route.js` · `skills/enade-it-questions/`.

## Contratos

- [ai-adapter-contract.md](../contracts/ai-adapter-contract.md) (`generateQuestions`) ·
  [quiz-schema.md](../contracts/quiz-schema.md).

## Invariantes e gotchas

- O preview das dissertativas mostra o `feedback_comment` como "Resposta esperada e critérios"
  (texto puro).
- Zero tooling de sanitização de HTML no app — por isso o strip no preview.
- A skill cobre RU/CM/AR/INT e **DISC** (discursiva, com Padrão de Resposta em
  `feedback_comment`); `references/quiz-schema.json` é cópia de `src/lib/quiz.schema.json` e
  `skills/enade-it-questions.skill` é o pacote remontado da pasta — atualizar os dois juntos.
- `skills/enade-it-questions/` é **versionada** (exceção no `.gitignore`), fonte de verdade do
  `SYSTEM_PROMPT` condensado; o download lê da pasta em runtime (`process.cwd()`).

## Dependências

- [ai-integrations.md](ai-integrations.md) · [prompt-customization.md](prompt-customization.md) ·
  [quiz-import.md](quiz-import.md)
