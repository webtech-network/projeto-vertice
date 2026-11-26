---
title: Login pelo Canvas entra na conta já vinculada ao ID do Canvas
status: accepted
date: 2026-11-26
supersedes: []
superseded_by: []
---

# ADR-0026: Login pelo Canvas usa a conta vinculada

## Contexto

O login pelo Canvas identificava a pessoa só por e-mail (real ou sintético,
[ADR-0001](0001-canvas-login-e-token-vault.md)). O Canvas nem sempre expõe o e-mail, então quem
usava Google e depois entrava com o Canvas caía em outra conta, sem os próprios dados. Mas quem
conecta o Canvas em `/perfil` já deixa em `integrations` o ID do Canvas ligado à conta.

## Decisão

No modo login, antes de recorrer ao e-mail, procurar em `integrations` as linhas com
`provider='canvas'`, o mesmo `provider_user_id` e a mesma instituição (`metadata.base_url`).

- Só contam contas com e-mail e login **Google ou GitHub**. Havendo mais de uma, vence a
  integração criada mais recentemente.
- Encontrou: o magic-link é gerado com o e-mail dessa conta.
- Não encontrou, ou a consulta falhou: segue o e-mail do Canvas, como antes.

## Alternativas consideradas

- **Casar por e-mail**: depende de o Canvas expor o mesmo e-mail do Google.
- **Considerar qualquer conta vinculada**: a conta duplicada criada pelo próprio Canvas tem o
  mesmo ID e poderia vencer a conta principal.
- **RPC nova**: exigiria migração manual; o `service_role` lê só colunas não secretas.

## Consequências

- Basta conectar o Canvas uma vez, logado com Google/GitHub.
- Dados de uma conta duplicada já criada **não** são migrados.
- Desconectar o Canvas apaga o vínculo; o login volta a seguir o e-mail.
- O vínculo prova que quem estava logado autorizou aquela conta do Canvas. Conectar, em
  computador compartilhado, o Canvas aberto por outra pessoa daria a ela acesso a esta conta no
  próximo login pelo Canvas; o nome conectado aparece no perfil para permitir conferir.
