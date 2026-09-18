# Decisions (ADRs)

Decisões arquiteturais registradas para responder **"por que foi feito assim?"** — o
conhecimento que antes estava espalhado em comentários "intencional, não é bug" dentro do
`CLAUDE.md`. As specs de `capabilities/` linkam para cá quando uma decisão explica o
comportamento; um ADR nunca duplica o "como funciona" — isso fica na spec.

Convenção: numerar sequencialmente (`0001`, `0002`, …), nome em kebab-case, `status` no
frontmatter (`accepted` ou `superseded`). Se uma decisão for revertida, marcar
`superseded` e apontar `superseded_by` — nunca apagar.

| ADR | Decisão |
| --- | --- |
| [0001](0001-canvas-login-e-token-vault.md) | Canvas é provedor de login **e** integração de API; token no Vault |
| [0002](0002-favoritos-default.md) | Cursos favoritos como default no CourseBrowser |
| [0003](0003-botao-ver-atividades.md) | Linha da tabela não é link; botão "Ver atividades" na célula de ações |
| [0004](0004-margem-5min-refresh.md) | Margem de segurança de 5 min no refresh do token do Canvas |
| [0005](0005-validacao-duas-camadas.md) | Validação estrutural bloqueante × schema não-bloqueante |
| [0006](0006-chaves-ia-write-only.md) | Chaves de IA nunca retornam em texto plano (write-only) |
| [0007](0007-ai-integrations-multi-instancia.md) | `ai_integrations` multi-instância substitui `ai_provider_keys` |
| [0008](0008-postgres-realtime-migracao.md) | IndexedDB → Postgres + Realtime; Google Drive sync removido |
| [0009](0009-tokens-github-google-navegador.md) | Token GitHub/Google no navegador, distinto do Canvas |
| [0010](0010-home-painel-sobre.md) | Home vira painel de widgets; pitch/features movidos para `/sobre` |
| [0011](0011-soft-delete-vs-delete.md) | Soft delete (workspaces/projects/tasks) × DELETE físico (shortcuts etc.) |
| [0012](0012-workspace-base-sintetico.md) | Workspace "Base" é sintético, nunca um registro |
