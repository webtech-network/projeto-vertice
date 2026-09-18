---
title: Validação estrutural bloqueante × schema não-bloqueante
status: accepted
date: 2026-09-17
supersedes: []
superseded_by: []
---

# ADR-0005: Validação em duas camadas

## Contexto

Arquivos reais em `Questoes/` desviam do schema (sem `question_model`, campo extra `nivel`
que esbarra em `additionalProperties: false`) e ainda são conteúdo legítimo a importar.

## Decisão

- `validateStructural(data)` — **bloqueante** (mínimo para chamar a API do Canvas com segurança).
- `createSchemaValidator` + `summarizeSchemaWarnings` — **não-bloqueante** (ajv), só avisos.

## Consequências

- Import seguro sem rejeitar conteúdo real.
- Nunca tornar o schema obrigatório.

## Alternativas consideradas

- Schema obrigatório — rejeitado: quebraria arquivos reais legítimos.
