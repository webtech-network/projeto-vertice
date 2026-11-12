import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { createClient, createQuestion } from '../lib/canvasClient.js';
import {
  validateStructural,
  createSchemaValidator,
  toCanvasPayload,
  QUESTION_TYPE_LABELS,
} from '../lib/quizValidation.js';
import quizSchema from '../lib/quiz.schema.json' with { type: 'json' };
import { red, green, yellow, cyan, bold } from './colors.js';
import { confirm } from './prompt.js';

dotenv.config();

const HELP_TEXT = `
Uso: npm run cli -- [arquivo.json] [opções]

Importa questões de múltipla escolha de um arquivo JSON para um quiz do Canvas LMS.

Argumentos:
  arquivo.json      Caminho do arquivo de questões (padrão: quiz_data.json)

Opções:
  -y, --yes         Não perguntar confirmação antes de enviar
      --dry-run     Valida e mostra o que seria enviado, sem chamar a API do Canvas
      --no-color    Desativa cores na saída
  -h, --help        Mostra esta ajuda

Variáveis de ambiente (.env):
  CANVAS_API_URL     URL base da API do Canvas (ex: https://sua-instituicao.instructure.com/api/v1)
  CANVAS_API_TOKEN   Token de acesso pessoal do Canvas

Exemplos:
  npm run cli -- quiz_data.json --dry-run
  npm run cli -- "Questoes/DIW-prova2/JSON/questoes-json-basico.json" --yes
`;

function parseArgs(argv) {
  const args = { file: null, yes: false, dryRun: false, help: false };
  for (const arg of argv) {
    if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--no-color') continue; // handled by colors.js
    else if (!arg.startsWith('-') && !args.file) args.file = arg;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  const API_URL = process.env.CANVAS_API_URL;
  const API_TOKEN = process.env.CANVAS_API_TOKEN;

  if (!API_URL || !API_TOKEN) {
    console.error(red('Erro: CANVAS_API_URL e CANVAS_API_TOKEN devem estar configurados no arquivo .env'));
    process.exitCode = 1;
    return;
  }

  const jsonFilePath = args.file || 'quiz_data.json';
  const absolutePath = path.resolve(jsonFilePath);
  console.log(cyan(`Lendo arquivo de dados: ${absolutePath}`));

  let config;
  try {
    const fileData = await fs.readFile(absolutePath, 'utf-8');
    config = JSON.parse(fileData);
  } catch (err) {
    console.error(red(`Erro ao ler/interpretar o arquivo: ${err.message}`));
    process.exitCode = 1;
    return;
  }

  const structural = validateStructural(config);
  if (!structural.valid) {
    console.error(red(bold('Arquivo inválido — corrija os erros abaixo antes de importar:')));
    structural.errors.forEach((e) => console.error(red(`  - ${e}`)));
    process.exitCode = 1;
    return;
  }

  const checkSchema = createSchemaValidator(quizSchema);
  const warnings = checkSchema(config);
  if (warnings.length > 0) {
    console.log(yellow(bold('Avisos (o arquivo não segue 100% o quiz.schema.json, mas será processado normalmente):')));
    warnings.forEach((w) => console.log(yellow(`  - ${w}`)));
  }

  const { course_id, quiz_id, questions } = config;

  console.log('');
  console.log(bold(`Curso: ${course_id}    Quiz: ${quiz_id}    Questões: ${questions.length}`));
  questions.slice(0, 5).forEach((q, i) => console.log(`  ${i + 1}. ${q.question_name}`));
  if (questions.length > 5) console.log(`  ... e mais ${questions.length - 5}`);
  console.log('');

  if (args.dryRun) {
    console.log(cyan('Modo --dry-run: nenhuma chamada será feita ao Canvas.'));
    questions.forEach((q, i) => {
      const payload = toCanvasPayload(q);
      const detail = payload.question.answers
        ? `${payload.question.answers.length} alternativa(s)`
        : QUESTION_TYPE_LABELS[payload.question.question_type];
      console.log(
        `  [${i + 1}/${questions.length}] "${payload.question.question_name}" — ` +
          `${detail}, ${payload.question.points_possible} ponto(s)`,
      );
    });
    return;
  }

  if (!args.yes) {
    const proceed = await confirm(bold('Prosseguir com a importação? (s/N)'));
    if (!proceed) {
      console.log('Importação cancelada.');
      return;
    }
  }

  const client = createClient({ baseUrl: API_URL, token: API_TOKEN });

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const label = `[${i + 1}/${questions.length}] "${q.question_name || 'Sem título'}"`;
    try {
      const payload = toCanvasPayload(q);
      const result = await createQuestion(client, course_id, quiz_id, payload);
      console.log(green(`${label} → Sucesso! ID no Canvas: ${result.id}`));
      successCount += 1;
    } catch (err) {
      const message = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.log(red(`${label} → Erro: ${message}`));
      failCount += 1;
    }
  }

  console.log('');
  console.log(bold(`${successCount} sucesso(s), ${failCount} falha(s) de ${questions.length}.`));
  if (failCount > 0) process.exitCode = 1;
}

main();
