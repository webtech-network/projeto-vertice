---
title: Renomeação CanvasTools → Vértice nos identificadores de armazenamento
status: accepted
date: 2026-11-09
supersedes: []
superseded_by: []
---

# ADR-0018: Identificadores de armazenamento com o nome Vértice

## Contexto

O produto se chamava CanvasTools e passou a se chamar Vértice. Além de textos e comentários,
o nome antigo estava em identificadores que guardam dados no navegador:

- o banco IndexedDB `canvastools`, que guarda os tokens de conexão GitHub/Google;
- as chaves `canvastools:*` do `localStorage` (tema, sidebar, ambiente ativo, preferências
  de tarefas);
- o cache do service worker `canvastools-shell-v1`;
- o campo `app` e o nome do arquivo exportado de tarefas.

Trocar esses nomes sem migração desconectaria GitHub e Google e perderia as preferências
locais. As preferências voltariam do Postgres, mas o tema piscaria errado no primeiro
carregamento.

## Decisão

Trocar todos para `vertice`, com migração no cliente:

- **`localStorage`**: o script de tema (`THEME_INIT_SCRIPT`, que roda antes de qualquer
  código do app em toda página) move cada `canvastools:*` para `vertice:*`, sem
  sobrescrever uma chave nova que já exista, e apaga a antiga.
- **IndexedDB**: o banco passa a ser `vertice`. Na primeira abertura, se `canvastools`
  existir (detectado por `indexedDB.databases()`), os registros de todos os stores, menos
  `cache`, são copiados sem sobrescrever os que já existem, e o banco antigo é apagado.
  Repetir é inofensivo. Se outra aba ainda usa o banco antigo, a exclusão espera em segundo
  plano e o próximo carregamento tenta de novo.
- **Service worker**: o cache passa a ser `vertice-shell-v1`. O `activate` já apaga
  qualquer cache com outro nome.
- **Exportação de tarefas**: `app: 'vertice'` e arquivo `vertice-tarefas-AAAA-MM-DD.json`.
  A importação valida `kind`, não `app`, então arquivos antigos continuam válidos.

As artes da marca antiga em `docs/Identidade Visual/canvastools_*` e `docs/canvastools.psd`
**não** foram renomeadas: o conteúdo delas é o logo do CanvasTools.

## Consequências

- Navegadores sem `indexedDB.databases()` (Firefox < 126) não migram o banco: nesses,
  GitHub/Google precisam ser reconectados uma vez.
- O código de migração lê os nomes antigos. Ele pode ser removido quando não houver mais
  instalações com dados do nome antigo.
