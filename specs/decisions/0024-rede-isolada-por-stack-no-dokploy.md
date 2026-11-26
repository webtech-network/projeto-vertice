---
title: Rede isolada por stack no Dokploy (alias único pro Kong)
status: superseded
date: 2026-11-22
supersedes: []
superseded_by: [0025]
---

# ADR-0024: Rede isolada por stack no Dokploy

## Contexto

Em produção (`docker-compose.dokploy.yml`) subiu-se uma **segunda aplicação com a mesma estrutura**
(db/auth/rest/realtime/kong) no mesmo servidor. O login pelo Canvas passou a falhar com
`Falha ao gerar o link de sessão Supabase para o Canvas: Unauthorized`, embora as chaves
(`JWT_SECRET`, `SERVICE_ROLE_KEY`) conferissem em todos os pontos.

Causa: o Dokploy anexa à `dokploy-network` — compartilhada por **todas** as aplicações do
servidor — os serviços com domínio (`app` e `kong`). Nessa rede o nome `kong` resolve para o Kong
de cada stack, e o DNS alternava entre os dois (`kong -> ['10.0.1.95', '10.0.1.69']`). A chamada
servidor→Supabase (`SUPABASE_INTERNAL_URL=http://kong:8000`) caía às vezes no Kong da outra stack,
que recusa a service key (401). Em rede overlay, `container_name` não resolve, então não serve
como nome único.

## Decisão

- Toda stack declara uma **rede própria** (`internal`; o Compose a nomeia `<projeto>_internal`) e
  **todos** os serviços entram nela. `db`, `auth`, `rest` e `realtime` ficam fora da
  `dokploy-network`; o Dokploy continua anexando a ela só `app` e `kong` (Traefik).
- O `kong` ganha o alias **`vertice-kong` somente na rede `internal`**. Na `dokploy-network` ele
  segue como `kong`, mas o app não usa mais esse nome: `SUPABASE_INTERNAL_URL=http://vertice-kong:8000`.
- O `realtime` ganha o alias `realtime-dev.vertice-supabase-realtime` (hostname do upstream no
  `kong.yml`; no compose local vem de `container_name`, que aqui não existia).
- Outra stack no mesmo servidor deve usar **alias próprio** (ex.: `outra-kong`).

## Alternativas consideradas

- **Isolated Deployment do Dokploy** (opção na UI): resolve, mas é configuração fora do repo, fácil
  de esquecer ao recriar a aplicação. Compatível com esta decisão; pode ser ligado também.
- **Renomear o serviço `kong`**: exige mexer nos domínios do Dokploy e deixa a colisão latente
  para qualquer nome genérico. Alias é mais barato e localizado.
- **`SUPABASE_INTERNAL_URL` = URL pública**: funciona (o código cai na pública se vazia), mas
  adiciona um salto pelo Traefik e mascara o problema.

## Consequências

- Resolução de `vertice-kong` é determinística: só existe na rede `internal` desta stack.
- `docker-compose.yml`/`supabase/docker-compose.yml` (dev local, stack única) **não mudam**:
  seguem usando `kong`.
- Diagnóstico futuro de 401 intermitente: comparar `dns.resolve4('<nome>')` dentro do app — mais de
  um IP indica colisão de nome entre stacks.
