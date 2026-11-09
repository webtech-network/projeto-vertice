---
title: Refresh do token Canvas single-flight e leituras paralelas com concorrência limitada
status: accepted
date: 2026-11-08
supersedes: []
superseded_by: []
---

# ADR-0016: Refresh single-flight e leituras paralelas

## Contexto

As specs proibiam `Promise.all` em chamadas ao Canvas. O motivo era uma corrida: com o
token perto de expirar, várias chamadas simultâneas recebiam 401 juntas. Cada uma chamava
`onUnauthorized`, que renovava o token e o regravava no Vault por conta própria, e a página
quebrava.

A regra resolveu o sintoma, mas tornou as páginas lentas. A correção com pares, por
exemplo, fazia até 8 chamadas em fila: curso, atividade, submissões, revisões, rubrica,
conjuntos de grupos, e depois uma chamada **por grupo** para buscar os membros.

## Decisão

- **Refresh single-flight por usuário** (`canvasIntegration.js`):
  - Um `Map<userId, Promise>` no processo garante uma única renovação em voo por usuário.
    Tanto o refresh proativo quanto o `onUnauthorized` esperam a mesma promessa.
  - Um token renovado há menos de 30 s é reaproveitado. Assim, um 401 que chega logo
    depois da renovação não dispara outra.
- **Leituras independentes podem ser paralelas**, com concorrência limitada:
  - `Promise.all` vale para poucas leituras independentes numa página, como curso,
    atividade e submissões.
  - Listas de tamanho variável, como os membros de cada grupo, passam por
    `mapWithConcurrency` com limite de 4 chamadas simultâneas, para não estourar o rate
    limit do Canvas (`X-Rate-Limit-Remaining`).
- **Escritas continuam sequenciais**: "Enviar todas as notas", aplicar ou desfazer a
  distribuição de pares e envios em lote. Isso preserva o progresso por linha e a regra de
  pular linhas vazias.
- A página do curso (`/courses/[courseId]`) deixa de chamar o Canvas no servidor. Nome e
  código vêm do cache de consultas do cliente ([ADR-0015](0015-cache-local-tanstack-query.md)).
- `loading.jsx` em `/courses/[courseId]` dá resposta imediata ao navegar para as páginas
  que ainda dependem do servidor (correção, pares, importação).

## Consequências

- Em uma única instância do app, a corrida some. Com várias réplicas, cada processo tem seu
  próprio `Map`. Uma renovação duplicada entre réplicas não quebra nada, porque o Canvas
  aceita vários access tokens do mesmo refresh token, mas não é deduplicada.
- O tempo de carregamento das páginas de correção e pares passa a ser o da chamada mais
  lenta, mais a etapa de grupos, em vez da soma de todas.
