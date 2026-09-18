---
title: Canvas é provedor de login e integração de API (token no Vault)
status: accepted
date: 2026-09-17
supersedes: []
superseded_by: []
---

# ADR-0001: Canvas é provedor de login e integração de API (token no Vault)

## Contexto

Antes da Fase 1, a sessão do app era `iron-session` e o token do Canvas ficava no cookie
httpOnly cifrado — sessão e capacidade de API acopladas. A migração para Supabase Auth pediu
separar as duas preocupações.

## Decisão

- **Sessão do app** = Supabase Auth (Google/GitHub/Canvas/passkey).
- **Token de API do Canvas** = linha em `public.integrations` (`provider='canvas'`), com
  access/refresh_token cifrados no Vault (só `*_vault_id` na tabela).
- Login "Entrar com Canvas" é um **bridge manual** (magic-link via
  `admin.auth.admin.generateLink`), porque o GoTrue self-hosted não tem provider "canvas".

## Consequências

- O token nunca chega ao navegador; refresh vira responsabilidade do chamador
  (`getCanvasClientForUser`), não do proxy.
- Contas não são linkadas entre provedores: Canvas-login usa e-mail real ou sintético
  (`canvas-<id>@<host>.vertice.invalid`), então logar por outro provedor cria conta separada.

## Alternativas consideradas

- Manter iron-session — rejeitado: re-acoplava sessão e token.
- Provider OAuth custom no GoTrue — rejeitado: mais infra para o mesmo resultado.
