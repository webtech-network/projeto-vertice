---
title: Cliente da API do Canvas
status: implemented
domain: canvas
updated: 2026-11-08
---

# Cliente da API do Canvas

> `src/lib/canvasClient.js` é o único caminho de HTTP para a REST API do Canvas.
> É **agnóstico à forma de auth** (token pessoal do CLI vs OAuth do web) e já resolve
> paginação, redação de segredo em erro e self-heal de 401.

## `createClient({ baseUrl, token, onUnauthorized })`

- Devolve um `axios` instance com `baseURL = normalizeBaseUrl(baseUrl) + '/api/v1'`.
- `normalizeBaseUrl()` aceita **domínio puro** (`https://school.instructure.com`) ou
  **domínio já com `/api/v1`** (convenção `CANVAS_API_URL` do CLI) e normaliza para o
  domínio puro.
- Injetor de request seta `Authorization: Bearer <token>` em toda chamada.
- `onUnauthorized` (async → token novo) é chamado **uma vez** num 401 (flag `_retried`
  por request); se retornar token, re-executa o request original. **Não persiste nada** —
  persistir o token renovado é responsabilidade do chamador ([canvas-integration.md](../platform/canvas-integration.md)).
- `sanitizeAxiosError()` é a barreira de saída de toda rejeição: redige
  `config.headers.Authorization` e apaga `error.request` (que carrega o Bearer em texto
  no header bruto) — nenhum token vaza para overlay/console de erro.

## Paginação

`fetchAllPages(client, url, params)` percorre o cabeçalho `Link` (`rel="next"`) até o fim
e concatena os arrays. Todas as listas usam `per_page: 100`.

## Métodos (agrupados por domínio)

**Identidade/curso**: `getSelf`, `getCourse(courseId)`, `listCourses({ enrollmentType='teacher',
enrollmentState='active' })` — sempre `include[]=favorites,needs_grading_count,total_students`. `listUserCourses()` junta professor + aluno (dedupe por `id`; marca `user_role: teacher|student`, professor vence; falha na busca de aluno vira `[]`) — usado por `/courses` e `/mensagens`.

**Atividades/quiz**: `listAssignments(courseId)`, `getAssignment(courseId, assignmentId)`
(única ação documentada que garante o campo `rubric`), `getQuiz(courseId, quizId)`,
`createQuestion(courseId, quizId, payload)` (POST `.../questions`, a API de import de questões).

**Correção com rubrica**: `listSubmissions(courseId, assignmentId, { include })`
(`include[]=user,rubric_assessment`), `gradeSubmissionWithRubric(courseId, assignmentId,
userId, payload)` (PUT; payload já no shape `{ rubric_assessment, submission, comment }`).

**Grupos e avaliação por pares**: `listGroupCategories(courseId)`
(`GET /courses/:id/group_categories`), `listGroupCategoryGroups(categoryId)`
(`GET /group_categories/:id/groups`), `listGroupUsers(groupId)` (`GET /groups/:id/users`),
`listPeerReviews(courseId, assignmentId)` (`GET .../assignments/:aid/peer_reviews`),
`createPeerReview(courseId, assignmentId, submissionId, userId)` (POST
`.../submissions/:submission_id/peer_reviews`, `user_id` = revisor) e
`deletePeerReview(...)` (DELETE no mesmo caminho, `user_id` como parâmetro) e
`getRubric(courseId, rubricId, { include })` (`GET /courses/:id/rubrics/:rid`, `style=full`;
com `include: ['peer_assessments']` traz `assessments[]` com `assessor_id`, `artifact_id` =
id da submissão, `score` e `data[].comments`).

**Mensagens (Inbox)**: `listConversations({ filter, scope })` (exclui arquivadas por padrão),
`getConversation(id)` (thread completa, sob demanda), `archiveConversation(id)`,
`replyToConversation(id, body)` (omite `recipients` = responde à thread),
`createConversation({ recipients, subject, body, contextCode })` (`group_conversation:false`
sempre — cópia individual por destinatário; chunk manual se > 100 destinatários).

**Alunos**: `listCourseStudents(courseId, { include })` — `enrollment_type[]=student`,
`enrollment_state[]=active,invited,inactive,completed` (filtro/label client-side; `email`
é include não-oficial, fallback em `login_id`).

**Favoritos**: `addCourseFavorite(courseId)`, `removeCourseFavorite(courseId)`.

**Analytics (engajamento)**: `getStudentSummaries(courseId)` (uma linha por aluno, curso
inteiro; 404/403 = conta sem Analytics), `getStudentAssignmentAnalytics(courseId, studentId)`
(por tarefa de um aluno; sob demanda).

## Invariantes e gotchas

- `listAssignments` traz `quiz_id` **só** para classic Quiz (`submission_types:['online_quiz']`);
  `is_quiz_assignment` sinaliza New Quizzes (não importáveis por esta API) — não confundir.
- `listCourseStudents` pede `enrollment_state` amplo de propósito: o filtro `active` do Canvas
  é não-confiável (alunos desativados já voltaram como `active`), então filtra client-side.
- Endpoints de grupo (`/groups/:id/users`, `/memberships`, `/group_categories/:id/groups`)
  paginam com **10 por padrão** — sempre `fetchAllPages` + `per_page: 100`.
- `peer_reviews`, `peer_review_count`, `automatic_peer_reviews` e `intra_group_peer_reviews`
  vêm no próprio objeto Assignment. O path de peer review usa o **id da submissão**, não o
  do aluno; no item retornado, `assessor_id` = revisor e `user_id` = dono da submissão.
- `getRubric` com `peer_assessments` traz as avaliações de **todas** as atividades que usam
  a rubrica: filtre por `artifact_id` ∈ submissões da atividade. O id da rubrica vem de
  `assignment.rubric_settings.id`.
- `posted_grade` vazio num PUT de submissão **remove** a nota: nunca envie nota vazia.
- Leituras independentes podem ser paralelas (`Promise.all`); listas de tamanho variável usam
  `mapWithConcurrency` (limite 4). Escritas em lote seguem **sequenciais**. O refresh do token
  é single-flight por usuário — ver [ADR-0016](../decisions/0016-refresh-single-flight-leituras-paralelas.md).

## Dependências

- [canvas-integration.md](../platform/canvas-integration.md) ·
  [rubric-grading.md](../capabilities/rubric-grading.md) ·
  [messages.md](../capabilities/messages.md) · [student-engagement.md](../capabilities/student-engagement.md) ·
  [peer-review-distribution.md](../capabilities/peer-review-distribution.md) ·
  [peer-review-grading.md](../capabilities/peer-review-grading.md)
