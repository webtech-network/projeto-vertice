---
title: ai_integrations multi-instância substitui ai_provider_keys
status: accepted
date: 2026-09-17
supersedes: []
superseded_by: []
---

# ADR-0007: `ai_integrations` multi-instância substitui `ai_provider_keys`

## Contexto

Um professor pode ter várias chaves/hosts do mesmo provedor (ex.: duas integrações OpenAI com
keys/base URLs diferentes, ou uma OpenAI apontada para um host compatível).

## Decisão

Tabela `ai_integrations` com **uma linha por integração** (não por provedor); `provider` é o id
do **driver** (protocolo). Driver ≠ integração: `base_url` permite mirar qualquer host
protocolo-compatível; novo protocolo = novo módulo driver.

## Consequências

- N integrações por driver sem mudar código; nova "plataforma" compatível = só uma linha.
- Caiu o fallback `process.env['<PROVIDER>_MODEL']` (não fazia sentido com várias instâncias).

## Alternativas consideradas

- `ai_provider_keys` (1 linha por provedor) — rejeitado: inflexível para múltiplas chaves/hosts.
