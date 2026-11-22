---
title: Seleção múltipla de workspaces ativos
status: accepted
date: 2026-11-19
supersedes: []
superseded_by: []
---

# ADR-0021: Seleção múltipla de workspaces ativos

## Contexto

O filtro de escopo global (Topbar) permitia **um** workspace ativo por vez. Quem trabalha em
mais de um contexto ao mesmo tempo (ex.: duas disciplinas do semestre) precisava alternar. O
pedido foi poder marcar vários, apenas clicando, sem teclado.

## Decisão

- O estado ativo é uma **lista de ids** (`activeWorkspaceIds`). `activeWorkspaceId` continua
  existindo e vale o **primeiro** da lista (compatibilidade com os consumidores atuais, que só
  comparam com `BASE_WORKSPACE_ID`).
- **Base é exclusiva** ([ADR-0012](0012-workspace-base-sintetico.md)): marcar Base limpa os
  demais; marcar qualquer outro desmarca Base; esvaziar a lista volta para Base. Logo, "tem
  filtro" ⇔ o primeiro id não é Base.
- `getVisibleResourceIds` devolve a **união** dos recursos ligados aos workspaces marcados
  (`null` continua significando "sem filtro").
- Persistência: `localStorage` guarda a lista (JSON); no Postgres, `ui_preferences.active_workspace_ids`
  (coluna nova, `uuid[]`) e, em paralelo, `active_workspace_id` com o primeiro id — assim um
  banco ainda sem a migração continua funcionando (só sincroniza o primário).
- Alt+1..9 continua selecionando **um** workspace (substitui a seleção).

## Consequências

- Nenhuma tela de consumo precisou mudar de contrato; telas que mostravam o nome do workspace
  ativo passam a mostrar os nomes juntos.
- A migração é manual e aditiva (`manual/14_ui_preferences_active_workspace_ids.sql`);
  enquanto não rodar, o multi-seleção funciona neste dispositivo mas só o primário sincroniza.

## Alternativas consideradas

- Interseção em vez de união — rejeitado: esvaziaria a lista para quem usa workspaces
  disjuntos, que é o caso comum.
- Trocar `active_workspace_id` por array (breaking) — rejeitado: quebraria dispositivos/banco
  sem a migração.
