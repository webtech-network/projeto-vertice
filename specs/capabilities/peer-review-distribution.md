---
title: Distribuição de avaliação por pares entre grupos
status: implemented
domain: canvas
updated: 2026-10-27
---

# Distribuição de avaliação por pares entre grupos

> Distribui as avaliações por pares de uma atividade de modo que cada aluno avalie apenas
> colegas de **outros grupos**, com carga equilibrada, e aplica o resultado no Canvas.

## Propósito

A distribuição do Canvas ignora o conjunto de grupos que o professor usa (projetos em
equipe), por isso um aluno pode acabar avaliando o próprio colega de equipe. Esta
capacidade substitui o script avulso `distribuir.php`
([ADR-0013](../decisions/0013-distribuicao-pares-por-grupos.md)).

## Comportamento

- **Entrada**: botão "Distribuir avaliação por pares" na aba Atividades
  ([atividades.md](atividades.md)), exibido **somente** quando `assignment.peer_reviews`.
  Ele leva a `courses/[id]/assignments/[aid]/peer-reviews`.
- **Conjunto de grupos** (group category do curso):
  - Se a atividade tem `group_category_id`, esse conjunto vem pré-selecionado.
  - Se o curso tem um único conjunto, ele é o padrão e o seletor fica oculto.
  - Se há vários, o professor escolhe um.
  - Se não há nenhum, a página explica isso e não oferece ação.
- **Participantes**: só alunos **com entrega** (`attempt` ou `submitted_at` presente,
  não `excused`), que atuam como revisores e como revisados. Não basta usar
  `workflow_state`, porque uma não-entrega com nota lançada também fica `graded`. Quem
  entregou e não pertence a nenhum grupo do conjunto vira um grupo unitário e aparece
  nos avisos.
- **N revisões**: o padrão é `assignment.peer_review_count` (3 se vier vazio) e pode ser
  editado.
  - Meta: cada participante revisa N colegas de outros grupos e cada submissão recebe N
    revisões.
  - Quando a meta não é viável, os déficits aparecem na tela. A regra de grupo **nunca**
    é relaxada.
- **Pré-visualização**: resumo (participantes, grupos, remover/criar/manter, déficits) e
  tabela revisor → revisados, com os grupos. "Redistribuir" sorteia de novo.
- **Refazer do zero**: o estado final no Canvas é exatamente o plano.
  - Revisões existentes fora do plano são **removidas**, as que coincidem com o plano
    são mantidas e as que faltam são criadas.
  - Remover uma revisão já concluída (`workflow_state: completed`) apaga o trabalho do
    aluno. Por isso essas remoções aparecem destacadas e exigem um checkbox de
    confirmação.
- **Aplicação**:
  - Precisa de `confirm`.
  - Executa os DELETEs e depois os POSTs, **um por vez**, com barra de progresso.
  - Falhas vão para uma lista que pode ser reexecutada.
  - Ao final, a página recarrega o estado. Uma segunda execução sem mudanças resulta em
    diff vazio.

- **Remover distribuição**: botão na barra de ferramentas, desabilitado sem revisões
  existentes. Pede `confirm` (com a contagem de revisões já concluídas, cujo trabalho é
  perdido) e apaga **todas** as revisões da atividade com os mesmos DELETEs sequenciais,
  barra de progresso e lista de falhas reexecutável. Serve para corrigir uma aplicação
  errada e recomeçar.

## Arquivos-chave

| Arquivo | Papel |
| --- | --- |
| `src/lib/peerReviewDistribution.js` | `planPeerReviews` / `diffPeerReviews` (puros) |
| `src/app/(dashboard)/courses/[courseId]/assignments/[assignmentId]/peer-reviews/page.jsx` | Server: carrega curso, atividade, conjuntos, submissões e revisões |
| `src/components/PeerReviewDistributor.jsx` | UI: seletor, pré-visualização, aplicação sequencial |
| `src/app/api/canvas/courses/[courseId]/assignments/[assignmentId]/peer-reviews/route.js` | POST/DELETE de uma revisão |
| `src/app/api/canvas/courses/[courseId]/group-categories/[categoryId]/groups/route.js` | GET grupos + membros de um conjunto |
| `src/lib/peerReviewGroups.js` | `loadGroupsWithMembers` (sequencial), usado pela página e pela rota |

## Dados e persistência

Não há persistência própria. O estado vive no Canvas (peer reviews da atividade), e o
plano existe só em memória até ser aplicado.

## Contratos

- [canvas-api.md](../contracts/canvas-api.md): `listGroupCategories`,
  `listGroupCategoryGroups`, `listGroupUsers`, `listPeerReviews`, `createPeerReview`,
  `deletePeerReview`.

## Decisões

- [ADR-0013](../decisions/0013-distribuicao-pares-por-grupos.md): algoritmo de
  deslocamento circular, "refazer" aplicado como diff, destino do `distribuir.php`.

## Invariantes e gotchas

- Revisor e revisado **nunca** pertencem ao mesmo grupo do conjunto escolhido, e
  ninguém revisa a si mesmo.
- O POST de revisão usa o **id da submissão** (não o do aluno); `user_id` é o revisor.
- Com `automatic_peer_reviews` ligado, o Canvas pode atribuir mais revisões na data
  configurada, ignorando os grupos. A tela avisa para desligar.
- `intra_group_peer_reviews` do Canvas só vale para atividades em grupo e não equilibra a
  carga, por isso não substitui esta capacidade.
- Chamadas ao Canvas são sempre sequenciais, sem `Promise.all`.

## Dependências

- [atividades.md](atividades.md) · [course-workspace.md](course-workspace.md) ·
  [canvas-integration.md](../platform/canvas-integration.md)
