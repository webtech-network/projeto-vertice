#!/usr/bin/env node
// spec-resolve.mjs — resolve um "pacote de contexto" de specs a partir de uma demanda.
//
// Mecanismo de gestão de janela de contexto: em vez de um agente ler o repositório
// inteiro (ou o antigo CLAUDE.md monolítico), ele resolve aqui o conjunto MÍNIMO de
// specs que precisa carregar — por keyword ou pelo id do bundle.
//
// Uso:
//   npm run spec --                       lista todos os bundles
//   npm run spec -- list                  idem
//   npm run spec -- "importar questões"   resolve por keyword → bundle + arquivos
//   npm run spec -- --bundle canvas-import  imprime o CONTEÚDO completo do bundle
//   npm run spec -- --index               imprime o índice (specs/index.md)
//   npm run spec -- --all                 imprime o conteúdo de TODAS as specs
//   npm run spec -- --check               valida consistência (links, index, bundles)
//
// Nenhuma dependência além do Node stdlib.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SPECS = join(ROOT, 'specs');
const BUNDLES_PATH = join(SPECS, 'agents', 'bundles.json');

const { bundles } = JSON.parse(readFileSync(BUNDLES_PATH, 'utf8'));

function readSpec(rel) {
  const p = join(SPECS, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

function listBundles() {
  for (const b of bundles) {
    console.log(`\n## ${b.id}${b.note ? ` — ${b.note}` : ''}`);
    console.log(`  keywords: ${b.keywords.join(', ')}`);
    for (const f of b.files) console.log(`  - ${f}`);
  }
  console.log('\nPara o conteúdo de um bundle: npm run spec -- --bundle <id>');
}

function resolveQuery(q) {
  const needle = q.toLowerCase();
  const hits = bundles.filter(
    (b) =>
      b.id.toLowerCase().includes(needle) ||
      b.keywords.some((k) => needle.includes(k.toLowerCase()) || k.toLowerCase().includes(needle)),
  );
  if (hits.length === 0) {
    console.log(`Nenhum bundle correspondeu a "${q}".`);
    console.log('Use: npm run spec -- list  para ver todos os bundles.');
    return;
  }
  for (const b of hits) {
    console.log(`\n## ${b.id}${b.note ? ` — ${b.note}` : ''}`);
    for (const f of b.files) console.log(`  - ${f}`);
  }
  console.log('\nPara o conteúdo completo de um bundle: npm run spec -- --bundle <id>');
}

function printBundle(id) {
  const b = bundles.find((x) => x.id === id);
  if (!b) {
    console.log(`Bundle "${id}" não existe. Use: npm run spec -- list`);
    return;
  }
  let bytes = 0;
  for (const f of b.files) {
    const content = readSpec(f);
    if (content == null) {
      console.log(`\n\n<!-- MISSING: ${f} -->`);
      continue;
    }
    bytes += Buffer.byteLength(content);
    console.log(`\n\n<!-- ===== ${f} ===== -->\n`);
    process.stdout.write(content);
  }
  console.error(`\n[bundle ${id}: ${b.files.length} arquivos, ${(bytes / 1024).toFixed(1)} KB]`);
}

function printIndex() {
  process.stdout.write(readSpec('index.md') ?? 'index.md não encontrado.\n');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '_templates') continue;
      walk(p, out);
    } else if (entry.name.endsWith('.md')) {
      out.push(p);
    }
  }
  return out;
}

function printAll() {
  const files = walk(SPECS).sort();
  let bytes = 0;
  for (const abs of files) {
    const content = readFileSync(abs, 'utf8');
    bytes += Buffer.byteLength(content);
    const rel = abs.slice(SPECS.length + 1);
    console.log(`\n\n<!-- ===== ${rel} ===== -->\n`);
    process.stdout.write(content);
  }
  console.error(`\n[todas as specs: ${files.length} arquivos, ${(bytes / 1024).toFixed(1)} KB]`);
}

// Validação de consistência (--check): frontmatter, bundles, links internos e o
// índice — para o index.md nunca "flutuar" em relação aos arquivos reais.
const INTERNAL_LINK = /\[[^\]]*\]\(([^)]+\.md)\)/g;
const INDEX_REF = /\((platform|contracts|capabilities|decisions|agents)\/[^)]+\.md\)/g;

function check() {
  const errors = [];
  const warnings = [];
  const files = walk(SPECS).sort();

  // 1. frontmatter obrigatório (pula index.md e READMEs)
  for (const abs of files) {
    const rel = abs.slice(SPECS.length + 1);
    if (rel === 'index.md' || rel.endsWith('README.md') || rel.startsWith('agents/')) continue;
    const content = readFileSync(abs, 'utf8');
    const fm = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) {
      errors.push(`${rel}: sem frontmatter`);
      continue;
    }
    for (const key of ['title', 'status']) {
      if (!new RegExp(`^${key}:`, 'm').test(fm[1])) errors.push(`${rel}: frontmatter sem '${key}'`);
    }
  }

  // 2. bundles referenciam arquivos existentes
  for (const b of bundles) {
    for (const f of b.files) {
      if (!existsSync(join(SPECS, f))) errors.push(`bundle '${b.id}': arquivo ausente → ${f}`);
    }
  }

  // 3. links internos entre specs resolvem
  for (const abs of files) {
    const rel = abs.slice(SPECS.length + 1);
    const content = readFileSync(abs, 'utf8');
    for (const m of content.matchAll(INTERNAL_LINK)) {
      const target = m[1];
      if (/^https?:/.test(target)) continue;
      if (!existsSync(resolve(dirname(abs), target))) errors.push(`${rel}: link quebrado → ${target}`);
    }
  }

  // 4. index.md referencia arquivos existentes
  const index = readSpec('index.md') ?? '';
  for (const m of index.matchAll(INDEX_REF)) {
    const target = m[0].slice(1, -1);
    if (!existsSync(join(SPECS, target))) errors.push(`index.md: referencia ausente → ${target}`);
  }

  // 5. órfãos (informacional): spec de conteúdo não citada em nenhum lugar
  const cited = new Set(['index.md']);
  for (const b of bundles) for (const f of b.files) cited.add(f);
  for (const m of index.matchAll(INDEX_REF)) cited.add(m[0].slice(1, -1));
  for (const abs of files) {
    const content = readFileSync(abs, 'utf8');
    for (const m of content.matchAll(INTERNAL_LINK)) {
      const target = m[1];
      if (/^https?:/.test(target)) continue;
      const absT = resolve(dirname(abs), target);
      if (existsSync(absT)) cited.add(absT.slice(SPECS.length + 1));
    }
  }
  for (const rel of files.map((p) => p.slice(SPECS.length + 1))) {
    if (rel === 'index.md' || rel.endsWith('README.md')) continue;
    if (rel.startsWith('agents/') || rel.startsWith('decisions/') || rel.startsWith('_templates/')) continue;
    if (!cited.has(rel)) warnings.push(`órfão (não citado em index/bundle/spec): ${rel}`);
  }

  if (errors.length) {
    console.log(`✗ ${errors.length} erro(s):`);
    for (const e of errors) console.log(`  - ${e}`);
  }
  if (warnings.length) {
    console.log(`⚠ ${warnings.length} aviso(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (!errors.length && !warnings.length) {
    console.log('✓ Consistência OK: index, bundles, links e frontmatter válidos.');
  } else if (!errors.length) {
    console.log(`✓ Sem erros (${warnings.length} aviso(s)).`);
  }
  process.exitCode = errors.length ? 1 : 0;
}

const [cmd, extra] = process.argv.slice(2);
switch (cmd) {
  case undefined:
  case 'list':
    listBundles();
    break;
  case '--index':
    printIndex();
    break;
  case '--all':
    printAll();
    break;
  case '--bundle':
    printBundle(extra);
    break;
  case '--check':
    check();
    break;
  default:
    resolveQuery(cmd);
}
