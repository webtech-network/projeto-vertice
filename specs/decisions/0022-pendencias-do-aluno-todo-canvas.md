---
title: Pendências do aluno via to-do e submissões faltantes do Canvas
status: accepted
date: 2026-11-19
supersedes: []
superseded_by: []
---

# ADR-0022: Pendências do aluno via to-do e submissões faltantes do Canvas

## Contexto

"Correções pendentes" só servia ao professor (`needs_grading_count`). Aluno precisa ver o que
**falta entregar**. O painel é cross-curso e já paga uma chamada de Canvas por curso para as
atividades do professor; repetir isso por curso como aluno multiplicaria chamadas.

## Decisão

- Termo único na UI: **Pendências**. Para o professor, "a corrigir"; para o aluno, "a fazer".
- Fonte do aluno: `GET /users/self/todo` (itens `submitting`, próximas entregas) **+**
  `GET /users/self/missing_submissions` (vencidas, não enviadas), mescladas e deduplicadas por
  id de atividade. Duas chamadas cross-curso, independentes de quantos cursos o aluno tem.
- Só entram atividades **com prazo** (`due_at`): sem prazo não há "pendência" objetiva.
- Best-effort: falha nessas chamadas não derruba o painel (entra em `errors` como `todo`).
- Por curso (`/courses`), `todo_count` é derivado dos mesmos itens (sem chamada extra).

## Consequências

- Aluno e professor usam o mesmo widget/coluna, com rótulo por papel; quem tem os dois vê as
  duas seções.
- O to-do do Canvas tem janela própria (próximos dias); o que está fora dela aparece só se já
  vencido (`missing_submissions`). Aceito: é o mesmo critério do próprio Canvas.

## Alternativas consideradas

- Varrer `listAssignments` + submissão do aluno por curso — rejeitado: N chamadas por curso.
- Incluir atividades sem prazo — rejeitado: ruído; pode ser revisto.
