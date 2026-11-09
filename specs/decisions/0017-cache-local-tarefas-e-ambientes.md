---
title: Cache local de tarefas, projetos e ambientes como espelho do estado
status: accepted
date: 2026-11-09
supersedes: []
superseded_by: []
---

# ADR-0017: Cache local de tarefas, projetos e ambientes

## Contexto

Tarefas, projetos, ambientes e vínculos vivem no Postgres e chegam ao vivo pelo Realtime
([ADR-0008](0008-postgres-realtime-migracao.md)). Mesmo assim, toda visita a `/tarefas`, ao
painel ou a qualquer página (o `WorkspaceScopeProvider` fica no layout) começava vazia e
esperava o Supabase. Com um ambiente ativo diferente de Base, a lista de cursos ficava vazia
até os vínculos chegarem.

O Realtime também tem uma lacuna: com o canal desconectado (notebook dormindo, rede caída),
os eventos do período se perdem e o estado fica defasado até a próxima recarga.

## Decisão

- **O cache de consultas é um espelho, não a fonte do estado.** `TasksProvider` e
  `WorkspaceScopeProvider` mantêm o próprio estado (reducer e `useState`), com atualizações
  otimistas e Realtime intactos. A cada mudança, gravam tarefas, projetos, ambientes e
  vínculos no cache de consultas ([ADR-0015](0015-cache-local-tanstack-query.md)), que o
  persiste no IndexedDB. Assim nenhuma mutação precisa lembrar de atualizar o cache.
- **Ao montar**: pinta a partir do cache, se houver, e revalida em seguida no Postgres.
  Se a resposta fresca chegar antes do cache (raro), o cache é ignorado.
- **Revalidação completa, não delta (`updated_at > lastSync`)**. Em escala pessoal (centenas
  de linhas), a lista inteira custa poucas dezenas de ms. O delta exigiria mesclar com soft
  delete e cuidar de relógio. Se o volume crescer, reavaliar.
- **Lacuna do Realtime**: revalida ao voltar à aba depois de mais de 60 s escondida e no
  evento `online`.
- Chaves e helpers em `src/lib/query/localData.js`. O widget `DashboardDoingTasks` lê as mesmas
  chaves, com stale-while-revalidate. Modais de edição (ex.: `WorkspaceEditModal`) continuam
  lendo direto do Postgres: ali uma lista defasada custaria mais que a espera.

## Consequências

- `/tarefas`, o widget do painel e o filtro de ambiente aparecem na hora depois da primeira
  visita.
- Os dados pessoais no IndexedDB seguem as regras do ADR-0015: um usuário por dispositivo,
  limpeza no logout e retenção máxima.
- O espelho grava o estado inteiro a cada mudança. O persister já agrupa as gravações em no
  máximo uma por segundo, e o volume é pequeno.
