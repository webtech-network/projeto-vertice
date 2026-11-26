---
title: Nomes exclusivos por stack no Dokploy (serviços públicos e upstreams do Kong)
status: accepted
date: 2026-11-26
supersedes: [0024]
superseded_by: []
---

# ADR-0025: Nomes exclusivos por stack no Dokploy

## Contexto

A [ADR-0024](0024-rede-isolada-por-stack-no-dokploy.md) protegeu o app do Vértice com o alias
`vertice-kong`, mas manteve o serviço chamado `kong`. O Compose publica o nome do serviço em
**todas** as redes dele, inclusive na `dokploy-network`: outra aplicação do servidor que
resolvia `kong` passou a acessar o Kong do Vértice. No sentido inverso, o Kong do Vértice
(presente nas duas redes) chamava os upstreams `auth` e `rest`, nomes que outra stack pode
publicar na rede compartilhada.

## Decisão

- Serviços com domínio têm nome exclusivo: `vertice-kong` e `vertice-app`. Nenhum nome genérico
  do Vértice aparece na `dokploy-network`.
- O servidor Next chama o Supabase por `vertice-kong-internal`, alias que só existe na rede
  `internal` (`SUPABASE_INTERNAL_URL=http://vertice-kong-internal:8000`).
- Os upstreams do `kong.yml` usam nomes exclusivos: `vertice-supabase-auth`,
  `vertice-supabase-rest` e `realtime-dev.vertice-supabase-realtime`. No compose local eles vêm
  do `container_name`; no Dokploy são aliases da rede `internal`.
- `db`, `auth`, `rest` e `realtime` mantêm a rede própria da ADR-0024 e não entram na
  `dokploy-network`.

## Alternativas consideradas

- **Só aliases (ADR-0024)**: não remove o nome do serviço da rede compartilhada.
- **Isolated Deployment do Dokploy**: configuração fora do repositório, fácil de perder ao
  recriar a aplicação.

## Consequências

- Os domínios no Dokploy precisam apontar para `vertice-app` (porta 3000) e `vertice-kong`
  (porta 8000) antes do redeploy. Contêineres antigos `app`/`kong` não podem sobrar no ar.
- Volumes (`db-data`, `db-config`) não mudam.
- Uma segunda instância do próprio Vértice no mesmo servidor precisa de outros nomes.
