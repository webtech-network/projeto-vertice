# Pacotes de contexto (context bundles)

Um **bundle** é um agrupamento nomeado de specs que resolve um tipo comum de demanda.
Em vez de um agente ler o repositório inteiro (ou um `CLAUDE.md` monolítico), ele carrega
**somente o bundle** da tarefa.

A fonte legível por máquina é [`bundles.json`](bundles.json) (usada por
`scripts/spec-resolve.mjs`). Este arquivo é a explicação humana dos mesmos bundles.

## Os bundles

| Bundle | Para demandas de… | Specs |
| --- | --- | --- |
| `canvas-courses` | navegar cursos, pendências, atividades | canvas-integration, canvas-api, course-browser, course-workspace, atividades |
| `canvas-import` | importar questões num quiz | canvas-integration, validation-model, canvas-api, quiz-schema, quiz-import, atividades |
| `canvas-grading` | corrigir rubrica, notas, situação dos alunos | canvas-integration, canvas-api, rubric-grading, student-engagement |
| `canvas-messages` | mensagens/resposta com IA | canvas-integration, canvas-api, ai-adapter-contract, messages |
| `ai-integrations` | integrações de IA, drivers, modelos | ai-adapter-contract, supabase-schema, ai-integrations, perfil, prompt-customization |
| `ai-question-gen` | gerar questões com IA | ai-adapter-contract, quiz-schema, questoes, prompt-customization |
| `tasks` | tarefas, projetos, workspaces | data-storage, supabase-schema, tasks, workspaces, course-notes |
| `auth-platform` | login, sessão, gate, OAuth | routing-and-shell, auth-and-session, canvas-integration, oauth-connections |
| `data-model` | banco, RLS, Vault, Realtime | data-storage, validation-model, supabase-schema |
| `shell-ui` | shell, home, perfil, tema, conteúdo | routing-and-shell, dashboard-shell, login-and-landing, dashboard, perfil |
| `backend` | rotas de API, runtime de servidor, CLI | api-routes, validation-model, canvas-api, ai-adapter-contract, cli |
| `ux-ui` | visual/tema, acessibilidade, responsivo | design-system, routing-and-shell, dashboard-shell, perfil, tutorial-sobre |
| `devops` | deploy, containers, Supabase self-hosted, env | deployment-and-infra, data-storage, supabase-schema, ADR-0008 |

## Como resolver

```bash
npm run spec -- list                     # lista os bundles
npm run spec -- "importar questões"      # resolve por keyword
npm run spec -- --bundle canvas-import   # imprime o CONTEÚDO do bundle
npm run spec -- --check                  # valida links/index/bundles/frontmatter
```

## Adicionar um bundle novo

1. Edite `bundles.json` — adicione `id`, `keywords` (pt-BR, sem acento nas buscas fica
   mais tolerante), `files` (caminhos relativos a `specs/`) e `note`.
2. Atualize a tabela acima.
3. Vincule o bundle ao agente (de domínio ou de papel) em `README.md`.
