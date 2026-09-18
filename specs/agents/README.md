# Orquestração multiagente

O Vértice usa **sete agentes** + **um orquestrador**, em dois eixos complementares.
O orquestrador lê só `specs/index.md` e roteia; cada agente carrega só o seu manifesto
(bundle), nunca o repositório inteiro — é isso que mantém a janela de contexto enxuta.

## Dois eixos

- **Domínio (o quê)** — donos de áreas de produto: `canvas`, `ai`, `data`, `frontend`.
  Decidem comportamento; carregam capabilities + contratos do seu domínio.
- **Papel (como)** — responsabilidades técnicas transversais: `backend`, `ux_ui`,
  `devops_cloud`. Donos de uma camada técnica (servidor, visual, infra); carregam
  contratos, não capabilities de outros domínios.

**Precedência**: quando uma demanda toca uma camada técnica **e** um domínio, o agente de
**domínio** é dono do comportamento (o quê/porquê) e o agente de **papel** é dono do
*como* na sua camada. Ex.: "nova rota de analytics" → `canvas` define o comportamento;
`backend` implementa a rota em `src/app/api/**`.

## Agentes de domínio

| Agente | Domínio | Specs sempre em contexto | Bundles que puxa |
| --- | --- | --- | --- |
| `canvas` | Integração Canvas | `platform/canvas-integration.md`, `contracts/canvas-api.md` | `canvas-courses`, `canvas-import`, `canvas-grading`, `canvas-messages` |
| `ai` | IA e geração | `contracts/ai-adapter-contract.md` | `ai-integrations`, `ai-question-gen` |
| `data` | Dados/RLS/Realtime | `platform/data-storage.md`, `contracts/supabase-schema.md` | `tasks`, `data-model` |
| `frontend` | Shell/UI/perfil | `platform/routing-and-shell.md`, `platform/auth-and-session.md` | `shell-ui`, `auth-platform` |

## Agentes de papel técnico

| Agente | Camada dona | Specs sempre em contexto | Bundles que puxa |
| --- | --- | --- | --- |
| `backend` | Rotas `src/app/api/**`, runtime de servidor, CLI | `platform/api-routes.md`, `contracts/supabase-schema.md`, `platform/data-storage.md` | `backend` |
| `ux_ui` | `globals.css`, tokens/tema, primitivas, acessibilidade, responsivo | `platform/design-system.md`, `platform/routing-and-shell.md` | `ux-ui` |
| `devops_cloud` | `supabase/**`, `Dockerfile`, `docker-compose*.yml`, `.env`, build/deploy | `platform/deployment-and-infra.md` | `devops` |

> O CLI (`capabilities/cli.md`) é caso à parte: sem agente de domínio; resolvido pelo
> bundle `canvas-import` (importação) ou `backend` (runtime/CLI).

## Workflow Spec-Driven por demanda

1. **Resolver**: `npm run spec -- "<demanda>"` (ou ler `index.md`) → bundle + agente.
2. **Spec primeiro**: se a demanda muda comportamento, editar/criar a spec **antes** do código.
3. **Implementar**: o agente carrega o bundle e executa.
4. **Sincronizar**: se a implementação divergiu da spec, atualizar a spec.
5. **Registrar o porquê**: decisão não óbvia → novo ADR em `decisions/`.

## Definições executáveis (subagentes)

Os manifestos acima viram subagentes reais em `.claude/agents/*.md`. O prompt de cada um
é curto e determinístico: "leia `specs/index.md`, depois o bundle X (via
`npm run spec -- --bundle X`)". Isso garante que o subagente carregue o mesmo conjunto
mínimo de specs toda vez — reprodutibilidade no gasto de tokens.

## Regra de ouro

Um agente **nunca** deve carregar spec de outro domínio. Se a tarefa cruzar domínios
(ex.: resposta com IA numa mensagem do Canvas), o bundle já inclui as specs dos dois
(`contracts/ai-adapter-contract.md` dentro de `canvas-messages`) — não é o agente que
"vasculha" o outro domínio. Para os agentes de **papel**, a mesma regra com uma licença:
eles leem **contratos** (`contracts/*`) de qualquer domínio, mas nunca **capabilities**
que não lhes pertençam.
