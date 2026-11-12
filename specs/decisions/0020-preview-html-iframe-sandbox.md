---
title: Preview fiel do HTML das questões em iframe sandbox
status: accepted
date: 2026-11-12
supersedes: []
superseded_by: []
---

# ADR-0020: Preview do HTML das questões em `iframe` sandbox

## Contexto

Na revisão antes do import, o professor precisa ler a questão como o aluno verá no Canvas:
blocos `<pre><code>`, tabelas, ênfases. O texto puro (strip via `DOMParser`) perde essa
estrutura. O app não tem sanitizador de HTML, e o HTML vem de arquivo do usuário ou de IA —
injetá-lo no DOM (`dangerouslySetInnerHTML`) continua proibido.

## Decisão

- O preview completo da questão é um documento próprio num `<iframe srcdoc>` com
  `sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"` — **sem
  `allow-scripts`**: nenhum script, handler inline ou formulário do conteúdo executa.
- `allow-same-origin` existe só para o pai medir a altura do documento (`scrollHeight`) e
  ajustar o iframe; sem `allow-scripts` essa combinação não dá ao conteúdo acesso ao app.
- CSP no próprio `srcdoc`: `default-src 'none'`, estilos inline e imagens/fontes `https:`/`data:`.
  Links abrem em nova aba (`<base target="_blank">`).
- A "folha" do preview é **sempre clara** (fundo branco, tinta escura), independente do tema do
  app: o HTML das questões traz estilos inline pensados para o fundo branco do Canvas (ex.:
  `background:#f4f4f4` em `<pre>`), que ficariam ilegíveis sobre o tema escuro.
- `answer_text` é texto puro no Canvas → é escapado, nunca interpretado como HTML;
  `question_text`, `answer_comment` e `feedback_comment` são renderizados como HTML.

## Consequências

- Preview fiel sem abrir brecha de XSS no app.
- Um iframe por questão **aberta** no acordeão (só monta quando expandida).
- Imagens remotas referenciadas no HTML são carregadas pelo navegador ao abrir o preview.

## Alternativas consideradas

- Sanitizador (DOMPurify) + `dangerouslySetInnerHTML` — rejeitado: nova dependência e o CSS
  inline do conteúdo vazaria para o app (e vice-versa).
- Texto puro — rejeitado: perde código, tabelas e itens, que é justamente o que se revisa.
