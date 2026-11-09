---
title: Consolidação da avaliação por pares
status: implemented
domain: canvas
updated: 2026-11-08
---

# Consolidação da avaliação por pares

> Consolida as notas e os comentários que os alunos deram uns aos outros numa atividade
> com avaliação por pares. O professor revê, aplica penalidades por falta de participação
> e envia a nota final (com comentário) ao Canvas.

## Propósito

Substitui a ferramenta avulsa `avaliacao_pares/` (PHP + jQuery). Ela tinha token em
texto plano, envio que apagava notas e grupos misturados
([ADR-0014](../decisions/0014-consolidacao-avaliacao-por-pares.md)). A distribuição das
revisões é outra capacidade ([peer-review-distribution.md](peer-review-distribution.md)).

## Comportamento

- **Entrada**: botão "Consolidar avaliação por pares" na aba Atividades
  ([atividades.md](atividades.md)). Aparece **somente** quando `assignment.peer_reviews`
  e leva a `courses/[id]/assignments/[aid]/peer-grading`. Esta página e a de distribuição
  têm links uma para a outra.
- **Fontes** (servidor, sempre em sequência):
  1. `getCourse` e `getAssignment` (`rubric_settings`, `points_possible`).
  2. `listSubmissions` com `include[]=user,submission_comments`.
  3. `listPeerReviews`.
  4. `getRubric` com `include[]=peer_assessments`, se a atividade tiver rubrica.
  5. Grupos do conjunto padrão. O seletor de conjunto segue a mesma regra da distribuição.
- **Média dos pares**:
  - Média simples dos `score` das avaliações de rubrica feitas pelos pares. Só conta uma
    avaliação cujo `artifact_id` seja uma submissão desta atividade e cujo par
    (avaliador, submissão) exista em `peer_reviews`.
  - Convertida para a escala da atividade: `× points_possible da atividade ÷
    points_possible da rubrica`, quando os dois existem e são diferentes.
  - Arredondada para 2 casas.
  - Sem rubrica, não há média. A tela avisa, e todas as notas são manuais.
- **Situação de cada aluno** (filtros segmentados com contagem):
  - `Não entregou`: sem `attempt`/`submitted_at`. A nota sugerida é **0**.
  - `Sem avaliação`: entregou, mas nenhum par deu nota. Não há sugestão; o professor lança
    a nota **manualmente**.
  - `Revisões pendentes`: entregou, recebeu nota de algum par, mas ainda falta revisão.
  - `OK`: todas as revisões atribuídas a ele foram feitas.
  - `Penalizados`: filtro extra com as linhas que têm penalidade marcada.
  - `Notas divergentes`: filtro extra pela dispersão (ver abaixo).
  - Uma revisão desconsiderada não conta como pendente: `OK` significa que todas as
    revisões **consideradas** foram feitas.
- **Avaliações desconsideradas** (avaliação descuidada):
  - O professor pode **desconsiderar** qualquer avaliação de par, no detalhe da linha
    (recebidas ou feitas). A decisão é reversível e fica só em memória.
  - Uma avaliação desconsiderada:
    - **sai da média** do aluno avaliado, que passa a contar só as demais. Se todas
      forem desconsideradas, o aluno fica `Sem avaliação` (nota manual);
    - **conta como não feita** na participação do avaliador. No modo proporcional entra
      como revisão não feita. No "tudo ou nada", ter **qualquer** avaliação
      desconsiderada já aplica os pontos cheios;
    - aparece riscada na coluna "Notas recebidas".
  - **Suspeita de descuido** (heurística, só sinaliza): nota **máxima** da rubrica com
    comentários somando menos que N caracteres (padrão 20, configurável). Fica marcada
    com um alerta na coluna e no detalhe. "Desconsiderar suspeitas" desconsidera todas de
    uma vez.
  - Ao desconsiderar ou reconsiderar, as notas preenchidas automaticamente do avaliado são
    recalculadas, e as linhas afetadas ficam alteradas.
  - No envio ao avaliador com avaliação desconsiderada, o comentário inclui o texto
    configurável de avaliação desconsiderada, com a quantidade.
- **Dispersão das notas recebidas**:
  - Desvio padrão (populacional) das notas **consideradas** de cada aluno, quando há
    pelo menos 2. É mostrado na coluna "Desvio", que pode ser ordenada.
  - A cor vem do desvio relativo ao valor da atividade, `σ ÷ points_possible`, com um
    limite L configurável (padrão 15%):
    - abaixo de L: neutro;
    - de L a 2L: aviso (`--warn`);
    - 2L ou mais: alerta (`--err`).
  - Filtro "Notas divergentes" lista quem está em aviso ou alerta.
- **Detalhe da linha** (expandir):
  - Avaliações **recebidas**: avaliador, nota e comentários. Os comentários vêm dos
    critérios da rubrica e dos comentários da entrega escritos por quem foi designado
    revisor.
  - Avaliações **feitas** pelo aluno: colega, nota dada e comentários.
  - Resumo de participação: atribuídas, concluídas e com comentário.
  - Outros comentários da entrega (professor e o próprio aluno), à parte.
  - Pré-visualização da entrega (`SubmissionPreview`).
- **Penalidade por falta de participação**:
  - Painel global com o comentário, os pontos e o modo de cálculo.
    - **Tudo ou nada** (padrão do legado): aplica os pontos cheios a quem tem revisões
      atribuídas e não concluiu nenhuma, ou não comentou nenhuma.
    - **Proporcional**: `pontos × (revisões não feitas ÷ revisões atribuídas)`.
  - Opção "exigir comentário": quando ligada, uma revisão só conta como feita se tiver
    comentário. Vale para os dois modos e vem ligada por padrão.
  - Quem não tem revisões atribuídas nunca é penalizado.
  - "Aplicar penalidades" marca e preenche a penalidade sugerida de cada aluno. Em cada
    linha, um checkbox e um valor editável permitem ajuste fino.
- **Nota final**:
  - Começa com a nota atual do Canvas (`score`).
  - "Copiar médias" preenche **só os campos vazios** com `max(0, sugestão − penalidade)`.
  - Uma nota preenchida automaticamente é recalculada quando a penalidade da linha muda.
    Uma nota digitada pelo professor nunca é sobrescrita.
  - "Limpar notas" esvazia as notas.
  - Validação: número entre 0 e `points_possible`. Uma nota fora da faixa bloqueia o envio
    daquela linha.
- **Comentário ao aluno**:
  - Campo por linha.
  - No envio, junta o comentário da linha e, se a penalidade estiver marcada, o texto de
    penalidade (com os pontos). Vai como `comment.text_comment` e é omitido se ficar vazio.
- **Envio** (em sequência, um aluno por vez):
  - Por linha: um botão envia ou atualiza a nota e o comentário daquele aluno, com estado
    enviando / enviado / erro na linha.
  - Em lote: "Enviar ao Canvas" percorre as linhas **alteradas** que têm nota, pede
    `confirm`, mostra o progresso e lista as falhas, que podem ser reexecutadas.
  - Uma linha sem nota **nunca** é enviada, porque `posted_grade` vazio apaga a nota no
    Canvas.
- Sair da página com alterações não enviadas pede confirmação (`useUnsavedChangesGuard`).

## Arquivos-chave

| Arquivo | Papel |
| --- | --- |
| `src/lib/peerReviewGrading.js` | Funções puras: `consolidatePeerReviews`, `applyDiscards`, `isCarelessReview`, `dispersionLevel`, `suggestPenalty`, `computeFinalGrade`, `buildPeerGradeComment` |
| `src/app/(dashboard)/courses/[courseId]/assignments/[assignmentId]/peer-grading/page.jsx` | Servidor: carrega dados do Canvas e consolida |
| `src/components/PeerReviewGrader.jsx` | UI: filtros, penalidades, tabela, detalhe, envio |
| `src/app/api/canvas/courses/[courseId]/assignments/[assignmentId]/submissions/[userId]/route.js` | PUT de nota e comentário (reaproveitado) |
| `src/app/api/canvas/courses/[courseId]/group-categories/[categoryId]/groups/route.js` | Grupos ao trocar de conjunto (reaproveitado) |

## Dados e persistência

Não há persistência própria. As notas e os comentários vivem no Canvas. Penalidades,
avaliações desconsideradas e edições ficam só em memória até o envio. Recarregar a
página desfaz as desconsiderações (o Canvas não é alterado por elas).

## Contratos

- [canvas-api.md](../contracts/canvas-api.md): `getRubric`, `listSubmissions`
  (`submission_comments`), `listPeerReviews`, `gradeSubmissionWithRubric`.

## Decisões

- [ADR-0014](../decisions/0014-consolidacao-avaliacao-por-pares.md): média e escala,
  regras de penalidade, envio por aluno.

## Invariantes e gotchas

- Todos os alunos são indexados por `user_id`, nunca pelo nome (o legado confundia
  homônimos).
- `getRubric` com `peer_assessments` traz avaliações de **todas** as atividades que usam a
  rubrica. É preciso filtrar por submissões desta atividade.
- `posted_grade` vazio remove a nota no Canvas. Por isso o envio pula linhas sem nota.
- Reenviar uma linha com comentário cria **outro** comentário no Canvas, já que comentários
  não são substituídos.
- Chamadas ao Canvas são sempre sequenciais, sem `Promise.all`.

## Dependências

- [atividades.md](atividades.md) · [peer-review-distribution.md](peer-review-distribution.md) ·
  [rubric-grading.md](rubric-grading.md) · [canvas-integration.md](../platform/canvas-integration.md)
