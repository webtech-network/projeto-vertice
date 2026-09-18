---
title: Chaves de IA nunca retornam em texto plano (write-only)
status: accepted
date: 2026-09-17
supersedes: []
superseded_by: []
---

# ADR-0006: Chaves de IA são write-only

## Contexto

A chave de API é o segredo mais sensível do app; exibi-la de volta no cliente a expõe a
qualquer coisa que leia o DOM/traffic.

## Decisão

A chave só existe como `api_key_vault_id` (Vault). Nenhuma rota retorna o plaintext — só
`POST` (criar) e `DELETE`; leitura interna via RPC `SECURITY DEFINER` + `service_role`.
Re-validação ocorre apenas quando uma chave nova é enviada.

## Consequências

- A chave não pode ser exibida nem editada — só substituída por outra.
- A exceção que existia (export com credenciais) foi **removida** junto do export/import.

## Alternativas consideradas

- Chave editável/legível no cliente — rejeitado: expõe o segredo.
