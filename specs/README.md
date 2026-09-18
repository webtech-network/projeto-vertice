# Specs do Vértice (CanvasTools)

Esta pasta é a **fonte de verdade das especificações** do Vértice. Ela substitui o antigo
`CLAUDE.md` monolítico (≈50 KB carregados em toda sessão) por **specs modulares, carregáveis
sob demanda** — o mecanismo de gestão de janela de contexto deste projeto.

## O modelo (Spec-Driven Development)

1. **Spec primeiro.** Mudança de comportamento começa na spec (criar/atualizar), depois
   implementa, depois revisa e atualiza a spec para refletir o que de fato ficou.
2. **Modular e endereçável.** Cada spec é pequena e autocontida. Um agente carrega **só**
   as specs da sua demanda — nunca o repositório inteiro.
3. **Índice como porta de entrada.** [`index.md`](index.md) é o mapa (sempre carregado, ~1 KB):
   capacidade → arquivo → resumo de 1 linha → status → domínio.
4. **Decisões separadas do "como funciona".** O *porquê* fica em `decisions/` (ADRs);
   o *como* fica em `platform/`, `contracts/` e `capabilities/`.
5. **Ciclo de vida explícito.** Toda spec tem `status` no frontmatter.

## Estrutura

- `index.md` — manifesto. Sempre em contexto.
- `platform/` — fundamentos transversais (auth, roteamento, dados, validação).
- `contracts/` — interfaces consumidas pelos agentes (Canvas API, contrato de IA, schema).
- `capabilities/` — uma spec por funcionalidade de usuário.
- `decisions/` — ADRs (o porquê das decisões).
- `agents/` — orquestração multiagente + pacotes de contexto (`bundles.json`).
- `_templates/` — templates para criar specs novas.

## Gestão de janela de contexto

O fluxo de uma demanda:

```
orquestrador lê index.md
  → identifica a capacidade afetada e o bundle correspondente
  → despacha ao agente de domínio
  → agente carrega SOMENTE o bundle (3–6 specs), não o repo inteiro
```

[`scripts/spec-resolve.mjs`](../scripts/spec-resolve.mjs) mecaniza isso:

```bash
npm run spec -- list                    # lista os bundles
npm run spec -- "importar questões"     # resolve keyword → bundle + arquivos
npm run spec -- --bundle canvas-import  # imprime o CONTEÚDO do bundle
npm run spec -- --index                 # imprime o índice
npm run spec -- --check                 # valida links/index/bundles/frontmatter
```

## Ciclo de vida (status no frontmatter)

- `draft` — rascunho, não aprovado.
- `proposed` — proposta para revisão.
- `approved` — aprovada, ainda não implementada.
- `implemented` — reflete código em produção (a maioria das specs de backfill).
- `superseded` — substituída por outra spec/ADR (apontar `superseded_by`).

## Convenções

- Idioma: português (pt-BR); identificadores de código em inglês.
- Cada spec tem frontmatter `title`/`status`/`domain`/`updated`.
- Links entre specs usam caminho relativo (`../contracts/canvas-api.md`).
- Seções das capabilities em ordem fixa: **Propósito → Comportamento → Arquivos-chave →
  Dados e persistência → Contratos → Decisões → Invariantes e gotchas → Dependências**.
- Um arquivo de spec não deve passar de ~4 KB; se passar, é sinal de que precisa ser
  dividido em duas specs, ou de que detalhe demais está sendo duplicado de um contrato.

## Como atualizar (spec-first)

1. Encontre a spec afetada em `index.md`.
2. Edite-a **antes** de mexer no código (ou crie uma nova a partir de `_templates/`).
3. Implemente.
4. Se a implementação divergiu, atualize a spec. Não deixe apodrecer.
5. Se a decisão tem "porquê" não óbvio, registre um ADR em `decisions/`.
