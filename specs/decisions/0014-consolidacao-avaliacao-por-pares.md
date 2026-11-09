---
title: Consolidação da avaliação por pares (média, penalidade e envio por aluno)
status: accepted
date: 2026-11-08
supersedes: []
superseded_by: []
---

# ADR-0014: Consolidação da avaliação por pares

## Contexto

A consolidação das notas de pares era feita pela ferramenta avulsa `avaliacao_pares/`
(PHP + jQuery/DataTables). Ela tinha estes problemas:
- token do Canvas digitado no formulário e trafegando em texto plano;
- grupos de todos os conjuntos misturados; `memberships` e `peer_reviews` sem paginação;
- relatório de participação indexado pelo **nome** do aluno;
- envio em lote via `update_grades` que mandava **todos** os alunos, inclusive os de campo
  vazio (`posted_grade: ""` apaga a nota), com JSON montado por concatenação e sucesso
  presumido por `workflow_state == 'queued'`;
- penalidade só "tudo ou nada", ignorada se a nota já estivesse preenchida e capaz de
  gerar nota negativa;
- escala da rubrica usada como nota máxima, mesmo quando a atividade vale outro valor.

## Decisão

- **Média**:
  - Média simples dos `score` das avaliações de rubrica dos pares. Só contam pares
    (avaliador, submissão) que existem em `peer_reviews` desta atividade.
  - A média é convertida da escala da rubrica para a da atividade.
  - Quem entregou sem receber nenhuma nota fica sem sugestão (nota manual). Quem não
    entregou recebe sugestão 0, como no legado.
- **Penalidade**:
  - Há dois modos. O "tudo ou nada" (padrão, igual ao legado) e o "proporcional":
    `pontos × não feitas ÷ atribuídas`.
  - Opcionalmente, uma revisão sem comentário conta como não feita.
  - A nota final nunca é negativa.
  - A penalidade recalcula notas preenchidas automaticamente, mas nunca as digitadas pelo
    professor.
- **Envio por aluno** (`PUT .../submissions/:user_id`, reaproveitando a rota da correção
  por rubrica), em vez de `update_grades`:
  - um botão por linha, para enviar ou atualizar um aluno por vez;
  - um envio em lote sequencial, só das linhas alteradas e com nota;
  - progresso e lista de falhas reexecutável.
- **Avaliação descuidada**:
  - O professor desconsidera avaliações individualmente. A desconsiderada sai da média
    do avaliado e conta como **não feita** para o avaliador.
  - No "tudo ou nada", qualquer desconsiderada já gera a penalidade cheia: desconsiderar
    é um julgamento explícito do professor, e o modo sem isso deixaria impune quem
    descuidou de uma só revisão entre várias.
  - A heurística "nota máxima + comentário curto" só **sinaliza** suspeitas. Nunca
    desconsidera sozinha, porque nota máxima com pouco texto pode ser legítima.
- **Dispersão**: desvio padrão populacional das notas consideradas (≥ 2 notas), relativo
  ao valor da atividade. A cor tem dois níveis: limite L (padrão 15%) e 2L. A medida
  relativa vale para qualquer escala de pontos. O populacional evita inflar o caso
  comum de 2–3 avaliadores.
- **Rubrica do professor não é preenchida** nesta versão: só `posted_grade` + comentário.
- **Destino do `avaliacao_pares/`**: fica fora do git, apenas como referência histórica
  (como o `distribuir.php`).

## Consequências

- O erro de cada aluno aparece na própria linha e nenhuma nota é apagada por um campo
  vazio.
- Em turmas grandes, o lote leva mais tempo (uma requisição por aluno) do que o
  `update_grades`. Isso é atenuado porque só as linhas alteradas são enviadas.
- Reenviar uma linha com comentário duplica o comentário no Canvas.

## Alternativas consideradas

- `update_grades` com acompanhamento do Progress: é mais rápido, mas o erro vem agregado
  e por aluno não há visibilidade. Foi rejeitado por consistência com a correção por
  rubrica e com a distribuição.
- Preencher `rubric_assessment` com a média de cada critério: adiado para uma versão
  futura.
