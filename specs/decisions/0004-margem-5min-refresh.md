---
title: Margem de segurança de 5 min no refresh do token do Canvas
status: accepted
date: 2026-09-17
supersedes: []
superseded_by: []
---

# ADR-0004: Margem de segurança de 5 min no refresh do token do Canvas

## Contexto

Há ambiguidade sobre se um token renovado durante uma request é visível para o Server
Component renderizado na **mesma** request.

## Decisão

Refresh **proativo** quando o token está a ≤5 min de expirar; `onUnauthorized` (retry de 401)
como backstop independente para chamadas fora dos caminhos do proxy.

## Consequências

- A request atual sempre usa um token válido; a próxima navegação pega o renovado.
- O retry de 401 cobre o caso raro de chamada sem passar pelo gate.

## Alternativas consideradas

- Refresh no limite exato — rejeitado: risco de corrida na mesma request.
