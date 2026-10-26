---
title: Distribuição de avaliação por pares entre grupos por deslocamento circular
status: accepted
date: 2026-10-18
supersedes: []
superseded_by: []
---

# ADR-0013: Distribuição de pares entre grupos por deslocamento circular

## Contexto

O Canvas distribui revisões por pares sem considerar o conjunto de grupos do professor.
Antes, o problema era contornado pelo script `distribuir.php`, que tinha estes problemas:
- token em texto plano;
- grupos de todos os conjuntos do curso misturados;
- membros truncados em 10 por falta de paginação;
- quem não tinha grupo era confundido com o aluno de índice 0;
- first-fit guloso em ordem fixa, que deixava as últimas submissões sem revisores;
- revisões existentes ignoradas;
- N fixo em 3.

## Decisão

- **Algoritmo** (`planPeerReviews`):
  1. Embaralha grupos e membros com uma semente.
  2. Dispõe os grupos em **blocos contíguos** numa sequência circular de tamanho n, em que
     m é o tamanho do maior grupo.
  3. Quem está na posição i revisa `i+m … i+m+k−1 (mod n)`. A distância circular fica
     sempre em [m, n−m], então revisor e revisado nunca são do mesmo bloco. Cada aluno faz
     k revisões e cada submissão recebe k.
  4. Isso vale quando `k ≤ n − 2m + 1`. Fora disso, entra um guloso balanceado (menor
     carga primeiro, várias sementes) que reporta déficits sem quebrar a regra de grupo.
- **"Refazer do zero" como diff**: o estado final é o plano, mas o sistema só remove o que
  não está nele e só cria o que falta. Assim faz menos chamadas, preserva revisões
  concluídas que coincidem e permite reexecução idempotente.
- **Destino do `distribuir.php`**: fica fora do git, sem token (passa a ler
  `CANVAS_API_TOKEN`), apenas como referência histórica.

## Consequências

- A distribuição é equilibrada e verificável numa pré-visualização antes de tocar o
  Canvas.
- Remover revisões concluídas é possível, mas exige confirmação explícita.

## Alternativas consideradas

- Manter o first-fit do script: rejeitado, porque desequilibra e gera déficits evitáveis.
- Emparelhamento ótimo por fluxo máximo: rejeitado, porque é complexo demais para turmas
  em que o deslocamento circular já é ótimo.
- Usar `intra_group_peer_reviews` do Canvas: só vale para atividades em grupo e não
  equilibra a carga.
