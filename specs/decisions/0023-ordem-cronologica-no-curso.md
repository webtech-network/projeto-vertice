---
title: Ordem cronológica no curso (atividades por prazo, arquivos por envio, última mensagem)
status: accepted
date: 2026-11-19
supersedes: []
superseded_by: []
---

# ADR-0023: Ordem cronológica no curso

## Contexto

Houve **reclamações sobre o Canvas**: dentro de um curso, as listas não seguem uma ordem útil no
tempo. O caso mais citado é o dos **arquivos**, que aparecem **sem ordem de envio** — o professor
não consegue ver o que foi enviado por último. Atividades têm o mesmo problema de fundo: a lista
mistura o que ainda vai vencer com o que já passou, e as mensagens não levam direto ao que
chegou por último. O Vértice deve responder à pergunta "o que importa agora neste curso?" sem o
usuário precisar ordenar nem procurar.

## Decisão

- **Atividades** (sem ordenação manual): primeiro as que ainda vencem, da entrega **mais próxima
  de hoje até a mais distante**; depois as sem data; numa **camada separada abaixo**, "Já
  encerradas" (prazo vencido), da mais recente para a mais antiga. Ordenar por coluna volta à
  lista única.
- **Aba Arquivos** (nova, para **todos os papéis**): ordem cronológica de envio ao Canvas
  (`created_at`). Padrão **mais recente primeiro**; dropdown "Mais recente / Mais antigo" e mini
  busca por nome. Só metadados; abrir leva ao arquivo no Canvas.
- **Pendências** (a corrigir / a fazer) no painel de cursos abrem o curso na aba Atividades e
  levam à atividade de entrega mais próxima. O contador de **mensagens** abre a aba Mensagens já
  na conversa com a mensagem mais recente (`last_message_at`).

## Consequências

- Usa `GET /courses/:id/files?sort=created_at&order=desc` (nova rota `/api/canvas/courses/[id]/files`,
  cache na faixa `volatile`). Se o Canvas responder 401/403 (o que ele faz para curso sem
  arquivos ou com Arquivos oculto ao papel — indistinguíveis), a aba mostra o estado vazio, não um
  alerta de erro; só falhas reais (rede, 5xx) viram aviso (`loadError`). As demais abas seguem
  normais.
- "Encerrada" = **prazo vencido** (`due_at` no passado), não "entregue": a lista de atividades
  não traz a submissão do usuário. Pode ser refinado depois.

## Alternativas consideradas

- Só ordenar por coluna (já existia) — rejeitado: exige ação do usuário toda vez; a reclamação
  é justamente sobre o padrão.
- Esconder as encerradas — rejeitado: o professor ainda precisa corrigi-las; ficam na camada de
  baixo.
