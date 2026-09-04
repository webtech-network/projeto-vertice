# Supabase self-hosted — Vértice, Fase 1

Stack mínimo (5 serviços: `db`, `auth`, `rest`, `realtime`, `kong`) para rodar
localmente durante o desenvolvimento da Fase 1. Ver o plano completo em
`/Users/rommelcarneiro/.claude/plans/preciso-realizar-uma-mudan-a-eager-pine.md`
pelo racional de design (por que sem Studio/Storage/Supavisor, por que os
tokens ficam no Vault em vez de texto plano, etc.).

## Subir o stack

```sh
cd supabase
cp .env.example .env

# Gere JWT_SECRET (openssl rand -base64 48 | tr -d '\n' | cut -c1-64),
# REALTIME_DB_ENC_KEY (openssl rand -hex 8 — EXATAMENTE 16 bytes, "-hex 16"
# gera o dobro do tamanho e quebra o Realtime) e SECRET_KEY_BASE
# (openssl rand -base64 64 | tr -d '\n') e preencha no .env.
# Depois gere ANON_KEY/SERVICE_ROLE_KEY com o mesmo JWT_SECRET:
JWT_SECRET=<o-valor-que-você-gerou> node generate-jwt.mjs
# cole a saída (ANON_KEY=... / SERVICE_ROLE_KEY=...) no .env

docker compose up -d
docker compose ps   # os 5 serviços devem ficar "healthy"
```

Os dados do Postgres ficam em `./volumes/db/data` (bind mount, não volume
Docker anônimo) — é esse diretório que deve entrar no backup. Está no
`.gitignore` do projeto.

## Depois do primeiro `up`

A publicação do Realtime (`supabase_realtime`) só existe depois que o
container `realtime` roda sua própria migração — por isso
`volumes/db/manual/06_realtime_publication.sql` **não** está em
`volumes/db/init/` (que só roda uma vez, na criação do volume, antes do
Realtime existir). Rode manualmente depois que os 5 serviços estiverem
saudáveis:

```sh
docker compose exec -T db psql -U postgres -d postgres < volumes/db/manual/06_realtime_publication.sql
```

Depois disso, `volumes/db/manual/07_realtime_publication_v2.sql` adiciona à mesma publicação as
tabelas que migraram do IndexedDB pro Postgres depois da Fase 1 (`shortcuts`, `custom_prompts`,
`course_notes`, `course_workspace_links`) — arquivo separado porque `alter publication ... add
table` falha se a tabela já for membro, e as três de cima já foram adicionadas pelo script anterior:

```sh
docker compose exec -T db psql -U postgres -d postgres < volumes/db/manual/07_realtime_publication_v2.sql
```

`volumes/db/manual/08_ai_provider_keys.sql` cria a tabela `ai_provider_keys` (chaves de API de IA +
modelo escolhido por provedor, migradas do iron-session) — mesma ressalva de "instalação já
inicializada" das duas anteriores; instalações novas já ganham essa tabela direto de `04_schema.sql`/
`05_rls.sql`:

```sh
docker compose exec -T db psql -U postgres -d postgres < volumes/db/manual/08_ai_provider_keys.sql
```

## Provedores OAuth (Google/GitHub)

Preencha `GOOGLE_*`/`GITHUB_*` no `.env` e marque os respectivos
`*_ENABLED=true`. O redirect URI a cadastrar em cada provedor é sempre
`${API_EXTERNAL_URL}/callback` (ex.: `http://localhost:8000/auth/v1/callback`
em dev), não uma rota do Next.js — é o GoTrue quem recebe o callback OAuth
diretamente.

**Canvas não entra aqui.** Spike concluído (ver "Canvas como provedor de
login" no plano): o GoTrue self-hosted v2.189.0 não tem "canvas" na sua lista
fixa de provedores embutidos, e a API de "custom OAuth provider" encontrada
por engenharia reversa do binário é para o GoTrue atuar como *servidor*
OAuth para terceiros (direção oposta) — respondeu "OAuth server is
disabled" mesmo habilitada. O login com Canvas é feito por um bridge próprio
no Next.js (rota `/canvas/oauth2/callback`, reaproveitando `canvasOAuth.js`
como hoje, + Admin API do Supabase para materializar a sessão via
`admin.generateLink`), não por configuração deste stack.

## O que falta depois disso (fora deste diretório)

Este diretório só cobre a infraestrutura. O código do Next.js que efetivamente
usa esse stack (clients Supabase, novo `/login`, `proxy.js` reescrito,
`workspacesRepo`/`tasksRepo` sobre Postgres) é a próxima etapa — ver arquivos
críticos listados no plano.
