---
title: <Nome da funcionalidade>
status: draft          # draft | proposed | approved | implemented | superseded
domain: canvas         # canvas | ai | data | frontend | cli
updated: 2026-09-17
---

# <Nome>

> Resumo em uma frase: o que o usuário consegue fazer com isso.

## Propósito

Por que esta capacidade existe, qual problema do professor resolve.

## Comportamento

O que acontece, passo a passo, do ponto de vista do usuário. Estados de UI e fluxos
alternativos, se houver.

## Arquivos-chave

| Arquivo | Papel |
| --- | --- |
| `src/...` | ... |

## Dados e persistência

Onde os dados desta capacidade vivem (Postgres/RLS, Vault, IndexedDB, Canvas API ou
somente memória) e como fluem.

## Contratos

- [contrato](../contracts/xxx.md)

## Decisões

- [ADR-0001](../decisions/0001-xxx.md)

## Invariantes e gotchas

- Regra que não é óbvia lendo o código, e por que existe.

## Dependências

- [spec](../platform/xxx.md)
