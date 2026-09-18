---
title: Mensagens do Canvas
status: implemented
domain: canvas
updated: 2026-09-17
---

# Mensagens do Canvas

> A aba "Mensagens" do workspace do curso: caixa de entrada do Canvas com composição,
> resposta e assistência de IA (sugerir resposta / melhorar texto).

## Comportamento

- `CourseWorkspaceTabs` busca `GET /api/canvas/courses/[courseId]/messages` (lazy, na primeira
  abertura da aba) e renderiza `ComposeMessage` + `MessageList`.
- `MessageList`: lista conversas (`listConversations` com `filter: ['course_<id>']`), expande a
  thread sob demanda (`getConversation`), responder (`replyToConversation`), arquivar
  (`archiveConversation`).
- `ComposeMessage`: nova conversa (`createConversation`, `group_conversation:false` — cópia
  individual; chunk manual se >100 destinatários), destinatários "os alunos do curso" via
  `listCourseStudents`. `StudentMessageModal` manda a um aluno específico.
- IA: "Sugerir resposta com IA" (`suggestReply`) no `MessageList` e "Melhorar com IA"
  (`improveMessage`) no `ComposeMessage`/`StudentMessageModal` — usam as integrações
  configuradas (picker some se nenhuma).

## Arquivos-chave

- [ComposeMessage.jsx](src/components/ComposeMessage.jsx) · [MessageList.jsx](src/components/MessageList.jsx) ·
  `StudentMessageModal.jsx` · `src/app/api/canvas/courses/[courseId]/messages/route.js` ·
  `src/app/api/canvas/courses/[courseId]/students/route.js`.

## Contratos

- [canvas-api.md](../contracts/canvas-api.md) — `listConversations`, `getConversation`,
  `archiveConversation`, `replyToConversation`, `createConversation`, `listCourseStudents`.
- [ai-adapter-contract.md](../contracts/ai-adapter-contract.md) — `suggestReply`, `improveMessage`.

## Dependências

- [course-workspace.md](course-workspace.md) · [ai-integrations.md](ai-integrations.md) ·
  [prompt-customization.md](prompt-customization.md)
