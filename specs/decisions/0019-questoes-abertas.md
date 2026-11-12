---
title: Questões abertas no import e na geração por IA
status: accepted
date: 2026-11-12
supersedes: []
superseded_by: []
---

# ADR-0019: Questões abertas (`question_type`) no import e na geração

## Contexto

O formato de questões era só de múltipla escolha: `validateStructural` exigia ≥2 alternativas
com exatamente uma correta e `toCanvasPayload` fixava `multiple_choice_question`. Provas reais
combinam dissertativas, blocos de instruções e envio de arquivo — tipos que o quiz clássico do
Canvas aceita pela mesma rota `POST .../questions`.

## Decisão

- Campo opcional **`question_type`** na questão. Ausente = `multiple_choice_question` (arquivos
  antigos continuam válidos sem mudança). Aceitos: `multiple_choice_question`, `essay_question`,
  `text_only_question`, `file_upload_question`.
- **Estrutural (bloqueante)**: regras de alternativas só para múltipla escolha; tipos abertos
  aceitam `answers` ausente ou vazio (e ignoram qualquer conteúdo). Tipo desconhecido é **erro**
  — enviá-lo ao Canvas criaria algo diferente do pretendido.
- **Pontos**: `points_possible` passa a ser lido com `??` (o `0` é legítimo); `text_only_question`
  vai sempre com 0.
- Campo opcional **`feedback_comment`** (HTML) → `neutral_comments_html` do Canvas (comentário
  geral). Na geração por IA, dissertativas trazem nele a resposta esperada e os critérios de correção.
- **Schema**: `if/then` em `quiz.schema.json` torna `answers`/`question_model` obrigatórios só na
  múltipla escolha. `buildQuizOutputSchema()` remove esse `allOf` (dialetos de structured-output
  não suportam `if/then`) e expõe à IA apenas `multiple_choice_question` e `essay_question`.
- **Geração**: novo tipo de spec `DISC` (Dissertativa) → `essay_question` com
  `question_model: "DISC (Dissertativa)"`, `answers: []`.

## Consequências

- Importar provas mistas sem editar no Canvas depois.
- O `feedback_comment` pode ficar visível ao aluno após o envio, conforme as configurações de
  exibição de respostas do quiz — o professor controla isso no Canvas.
- `text_only_question`/`file_upload_question` não são gerados por IA (não faz sentido gerar
  instrução ou pedido de arquivo sem contexto da disciplina).

## Alternativas consideradas

- Inferir o tipo pela ausência de `answers` — rejeitado: ambíguo (MC malformada viraria
  dissertativa silenciosamente).
- Schema separado para questões abertas — rejeitado: arquivos de prova são mistos.
