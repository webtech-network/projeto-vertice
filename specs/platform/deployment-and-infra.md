---
title: Deploy e infraestrutura
status: implemented
domain: devops
updated: 2026-09-17
---

# Deploy e infraestrutura

> Como o Vértice roda em produção: Supabase **self-hosted** (Docker), o app Next.js em
> container, variáveis de ambiente e o que é público vs. segredo.

## Supabase self-hosted (Docker)

- `supabase/docker-compose.yml` sobe a stack local (Postgres + GoTrue/Auth + Realtime +
  Kong/API). Migração p/ self-hosted com Realtime: [ADR-0008](../decisions/0008-postgres-realtime-migracao.md).
- Schema/RLS versionados em SQL idempotente em `supabase/volumes/db/init/` (`01_roles` →
  `05_rls`) e `manual/` (`06`+ — publicações Realtime, chaves de IA, ui_preferences,
  ai_integrations, engagement, custom_prompts). **Nunca** editar o banco pela UI sem
  portar o SQL pra cá.
- Segredos do Supabase (service_role) em `supabase/.env` (não commitado);
  `supabase/.env.example` documenta as chaves.

## App (Next.js) em container

- `Dockerfile` (build multi-stage do Next). `docker-compose.yml` (dev/local) e
  `docker-compose.dokploy.yml` (produção, Dokploy). `npm run build` → `npm start`
  (porta 80, `-H 0.0.0.0`).
- `.env`/`.env.example`: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (públicos) e `SUPABASE_INTERNAL_URL` + `SUPABASE_SERVICE_ROLE_KEY` (servidor). Origem
  pública derivada de `APP_URL`/`CANVAS_OAUTH_REDIRECT_URI` (ver
  [routing-and-shell.md](routing-and-shell.md) sobre `getAppBaseUrl()`).
- `APP_PORT`/`SESSION_SECRET` (CLI). OAuth: `*_OAUTH_CLIENT_ID`/`_SECRET`/`_REDIRECT_URI`/
  `_SCOPES` p/ Canvas, GitHub e Google. Modelos de IA (`OPENAI_MODEL`, `GEMINI_MODEL`,
  `CLAUDE_MODEL`) e `NEXT_PUBLIC_PASSKEYS_ENABLED`.

## Healthcheck e análise

- `/api/health` (healthcheck). Google Analytics configurado no `layout` para o domínio do
  Vértice (ver commit `1ed4db1`).

## Invariantes e gotchas

- Segredos (`SUPABASE_SERVICE_ROLE_KEY`, `*_CLIENT_SECRET`, `SESSION_SECRET`,
  `CANVAS_API_TOKEN`) **nunca** em `NEXT_PUBLIC_*` nem commitados.
- URL pública ≠ interna do Supabase (Docker) — por isso `getSupabaseServerUrl()` e
  `getSupabaseStorageKey()` separam interno de público.
- Realtime exige publicação explícita (`06/07_realtime_publication*.sql`); **não**
  publicar `integrations`/`ai_integrations`.

## Dependências

- [data-storage.md](data-storage.md) · [routing-and-shell.md](routing-and-shell.md) ·
  [ADR-0008](../decisions/0008-postgres-realtime-migracao.md)
