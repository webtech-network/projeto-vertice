# CanvasTools

Web app e CLI para importar em lote questões de múltipla escolha para quizzes do Canvas LMS.

- **App web**: login via Canvas (OAuth2), navegação curso → quiz, upload de arquivo `.json` de questões, validação, seleção de questões e importação.
- **CLI**: importação direta via linha de comando a partir de um token de acesso pessoal do Canvas.

## Requisitos

- Node.js ≥ 20.9 e npm
- Para o **app web**: uma Developer Key do Canvas (client ID + client secret) registrada pelo administrador da sua instituição
- Para o **CLI**: um Token de Acesso Pessoal do Canvas (Conta → Configurações → "+ Novo Token de Acesso")

## Instalação

```bash
git clone <repo>
cd tools/CanvasQuiz
npm install
```

## Configuração

Copie `.env.example` para `.env` e preencha:

| Variável | Usado por | Descrição |
|---|---|---|
| `CANVAS_API_URL` | CLI | URL da API do Canvas, **com** `/api/v1` (ex: `https://sua-instituicao.instructure.com/api/v1`) |
| `CANVAS_API_TOKEN` | CLI | Seu Token de Acesso Pessoal do Canvas |
| `CANVAS_DOMAIN` | App web | URL da instituição, **sem** `/api/v1` (ex: `https://sua-instituicao.instructure.com`) |
| `CANVAS_OAUTH_CLIENT_ID` | App web | Client ID da Developer Key |
| `CANVAS_OAUTH_CLIENT_SECRET` | App web | Client Secret da Developer Key |
| `CANVAS_OAUTH_REDIRECT_URI` | App web | Deve casar **exatamente** com um dos Redirect URIs cadastrados na Developer Key |
| `CANVAS_OAUTH_SCOPES` | App web | Opcional — só necessário se a Developer Key tiver "Enforce Scopes" habilitado |
| `SESSION_SECRET` | App web | Chave de criptografia da sessão (≥ 32 caracteres). Gere com `openssl rand -hex 32` |
| `OPENAI_MODEL` | App web | Opcional — modelo usado na geração de questões com IA (padrão: `gpt-4o-mini` se vazio) |

### Registrando a Developer Key no Canvas (uma vez, feito pelo admin da instituição)

1. Admin do Canvas → **Developer Keys** → **+ Developer Key** → **API Key**.
2. Em **Redirect URI(s)**, cadastre uma URI por linha — pode registrar mais de uma ao mesmo tempo, por exemplo:
   ```
   http://localhost/oauth2/callback
   https://seu-dominio-de-producao.com/oauth2/callback
   ```
3. Ative a chave e copie o **Client ID** e o **Client Secret** para o `.env`.

### Ambientes de teste vs. produção

Uma mesma Developer Key pode ter várias Redirect URIs cadastradas (uma para dev, outra para produção), então normalmente **o mesmo `CANVAS_OAUTH_CLIENT_ID`/`CANVAS_OAUTH_CLIENT_SECRET` funciona nos dois ambientes** — só `CANVAS_OAUTH_REDIRECT_URI` muda entre eles. Siga a convenção do Next.js:

- `.env` — valores padrão/locais (já ignorado pelo git).
- `.env.production.local` — segredos de produção, definidos no host de deploy (também ignorado pelo git).

## Rodando com Docker

Sobe a stack inteira — app Next.js **e** a infra Supabase self-hosted (Postgres/Auth/PostgREST/
Realtime/Kong) — com um único comando.

**Pré-requisito**: Docker Compose ≥ 2.20.3 (o recurso `include:` usado em `docker-compose.yml` não
existe em versões mais antigas). Confira com `docker compose version`; se estiver desatualizado,
atualize o Docker Desktop (ou o plugin `docker-compose-plugin`, em Linux) antes de continuar.

```bash
cp .env.example .env                      # se ainda não tiver
cp supabase/.env.example supabase/.env    # se ainda não tiver
# preencha os dois .env — ver "Configuração" acima e supabase/README.md

docker compose up -d --build
docker compose ps      # confirma db/auth/rest/realtime/kong/app saudáveis
```

O app fica acessível em `http://localhost:${APP_PORT:-3000}` (ou a porta que você definir em
`APP_PORT` no `.env` da raiz — ajuste `APP_URL`/`CANVAS_OAUTH_REDIRECT_URI` no mesmo arquivo para
casar com ela, mesma lógica da seção "Ambientes de teste vs. produção" acima). `NEXT_PUBLIC_SUPABASE_URL`
continua sendo a URL pública do Kong (a que o navegador acessa); as chamadas que o próprio processo
Next.js faz ao Supabase usam a rede interna do Compose via `SUPABASE_INTERNAL_URL` — não precisa
mexer nisso, já vem configurado no `docker-compose.yml`.

Quer só a infra Supabase, sem o app (ex.: pra rodar o app fora do Docker com `npm run dev`)? Use
`supabase/docker-compose.yml` sozinho — ver `supabase/README.md`.

## Uso do app web

```bash
npm run dev
# ou, em produção:
npm run build && npm start
```

> **Atenção à porta:** `CANVAS_OAUTH_REDIRECT_URI` precisa casar **exatamente** com a Redirect URI cadastrada na Developer Key. Se ela foi cadastrada sem porta (ex: `http://localhost/oauth2/callback`, porta 80), rode o servidor Next.js na mesma porta — `npm run dev -- -p 80` (pode exigir privilégios elevados) ou um proxy reverso na frente — em vez do padrão `npm run dev` na porta 3000. Se o app estiver acessível em `http://localhost:3000` mas `CANVAS_OAUTH_REDIRECT_URI` apontar para a porta 80 (ou vice-versa), o login falha.

1. Acesse a URL onde o app está rodando (ver nota acima sobre a porta) — você será redirecionado para `/login`.
2. Clique em **"Entrar com Canvas"** → você é levado à tela de login/consentimento do próprio Canvas → após aprovar, volta para o app já autenticado.
3. No **Painel de Cursos** (um painel no estilo dashboard, com barra lateral escura à esquerda), localize o curso desejado. A lista abre por padrão em **★ Favoritos** (os cursos marcados como favoritos/em destaque no próprio Canvas) — se você não tiver nenhum favorito marcado, ela cai automaticamente para **Todos**. Use o campo de pesquisa (por nome ou código do curso) e o alternador **Todos / ★ Favoritos** para localizar rapidamente um curso. Cada linha mostra também o total de **avaliações pendentes de correção** (contagem calculada pelo próprio Canvas) e um ícone de status (publicado / não publicado / encerrado). O nome do curso é um link que abre a página do curso no Canvas em uma nova aba.
4. Clique no ícone de lista (com a dica "Ver atividades" ao passar o mouse), à direita da linha do curso, para abrir a lista de atividades daquele curso — cada uma com seu ícone de status, contagem de avaliações pendentes, e nome também clicável (abre a atividade no Canvas em uma nova aba). Para atividades do tipo **quiz clássico**, aparece um ícone de importação (dica "Importar questões"); atividades comuns (tarefas, quizzes novos/LTI) não têm essa opção, pois a importação de questões só se aplica a quizzes clássicos do Canvas.
5. Ao clicar no ícone de importação, envie o arquivo `.json` de questões:
   - Se o arquivo tiver problemas estruturais (faltar `course_id`, uma questão sem alternativa correta, etc.), a importação fica bloqueada e os erros são listados.
   - Avisos de formatação (ex: questão sem `question_model`, campos fora do schema) aparecem em um painel colapsável, mas **não bloqueiam** a importação — arquivos mais antigos sem todos os campos do schema continuam funcionando.
6. Marque/desmarque questões individualmente, ou use a caixa "selecionar todas" (todas vêm marcadas por padrão).
7. Clique em **"Importar selecionadas"** — o resultado por questão (sucesso com ID no Canvas, ou erro) aparece logo abaixo.

Sua sessão fica em um cookie criptografado e é renovada automaticamente enquanto você navega; nenhum token do Canvas chega ao JavaScript do navegador.

## Geração de questões com IA

Na seção **Questões** do painel (barra lateral), um professor pode gerar questões no padrão ENADE com a OpenAI em vez de escrever manualmente cada uma.

1. Na primeira vez, informe sua **chave de API da OpenAI** (obtida em https://platform.openai.com/api-keys) — ela é validada e guardada apenas na sua sessão (cookie criptografado), nunca em configuração compartilhada do servidor.
2. Adicione uma linha por questão desejada, informando **tema**, **nível** (Baixo/Intermediário/Alto) e **tipo** (RU — Resposta Única, CM — Complementação Múltipla, AR — Asserção-Razão).
3. Clique em **"Gerar questões"** — a geração pode levar até cerca de um minuto.
4. Revise a prévia (enunciado, alternativas, comentário da correta) e clique em **"Salvar arquivo"** para baixar o `.json`.
5. O arquivo gerado traz `course_id`/`quiz_id` como `0` (placeholders) — isso é normal: o curso/quiz reais são definidos depois, ao enviar esse mesmo arquivo pelo fluxo de importação já existente (**Cursos → Ver atividades → Importar questões**), que ignora o `course_id`/`quiz_id` do arquivo em favor do curso/quiz selecionados na tela.

## Uso do CLI

```bash
npm run cli -- quiz_data.json
```

| Opção | Efeito |
|---|---|
| `-y`, `--yes` | Não pergunta confirmação antes de enviar |
| `--dry-run` | Valida e mostra o que seria enviado, sem chamar a API do Canvas |
| `--no-color` | Desativa cores na saída |
| `-h`, `--help` | Mostra a ajuda |

**Exemplo — conferindo antes de enviar:**

```bash
$ npm run cli -- quiz_data.json --dry-run
Lendo arquivo de dados: /caminho/quiz_data.json
Avisos (o arquivo não segue 100% o quiz.schema.json, mas será processado normalmente):
  - Campo 'question_model' ausente em 2 local(is) (fora do padrão de quiz.schema.json).

Curso: 268500    Quiz: 617806    Questões: 2
  1. Questão 1 - História
  2. Questão 2 - Lógica

Modo --dry-run: nenhuma chamada será feita ao Canvas.
  [1/2] "Questão 1 - História" — 3 alternativa(s), 10 ponto(s)
  [2/2] "Questão 2 - Lógica" — 2 alternativa(s), 5 ponto(s)
```

**Exemplo — importação real:**

```bash
$ npm run cli -- "Questoes/DIW-prova2/JSON/questoes-json-basico.json"
Curso: 268500    Quiz: 617806    Questões: 10
  ...
Prosseguir com a importação? (s/N) s
[1/10] "Questão 1 — Definição do Formato" → Sucesso! ID no Canvas: 4839201
...
10 sucesso(s), 0 falha(s) de 10.
```

> **Atualizando da v1?** `npm start` agora inicia o servidor Next.js de produção, não o CLI. Use `npm run cli -- <arquivo>` no lugar do antigo `npm start`.

## Formato do arquivo de questões

Estrutura básica (veja `src/lib/quiz.schema.json` para o contrato completo, e `quiz_data.json` na raiz para um exemplo mínimo):

```json
{
  "course_id": 268500,
  "quiz_id": 617806,
  "questions": [
    {
      "question_name": "Questão 1",
      "question_text": "<p>Enunciado em HTML...</p>",
      "question_model": "RU",
      "points_possible": 1,
      "answers": [
        { "answer_text": "Alternativa correta", "is_correct": true, "answer_comment": "..." },
        { "answer_text": "Alternativa incorreta", "is_correct": false, "answer_comment": "..." }
      ]
    }
  ]
}
```

`question_model` (`RU`, `CM`, `AR`, `INT` — ver `quiz.schema.json`) e `answer_comment` por alternativa são recomendados pelo schema, mas **não são exigidos** para a importação funcionar — arquivos mais antigos em `Questoes/` sem esses campos importam normalmente, apenas com avisos.

## Estrutura do projeto

```
src/
  app/
    (dashboard)/  Layout do painel (barra lateral + topo) + páginas autenticadas: cursos, quizzes, importação, questões
    login/, api/**  Fora do painel — tela de login e rotas de API não usam a barra lateral
  components/     Sidebar.jsx, Topbar.jsx, CourseBrowser.jsx, ImportQuestions.jsx, QuestionGenerator.jsx
  lib/            canvasClient.js, canvasOAuth.js, session.js, quizValidation.js, quiz.schema.json, aiProviders/openai.js
  cli/            index.js, colors.js, prompt.js
  proxy.js        Proteção de sessão + renovação do token OAuth (Next.js "Proxy", ex-middleware)
Questoes/         Bancos de questões reais (dados, não código)
```

## Segurança

- O token de acesso do CLI (`.env`) e os tokens OAuth do app web nunca são enviados ao JavaScript do navegador — toda chamada ao Canvas acontece no servidor.
- A sessão do app web fica em um cookie `httpOnly` criptografado (`iron-session`); não há armazenamento de token no lado do cliente.
- `.env`, `.env.local`, `.env.*.local` e `node_modules` são ignorados pelo git — nunca commite segredos.
