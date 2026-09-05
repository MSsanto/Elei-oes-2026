import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dist = path.join(root, 'dist');
const editorialRoot = path.join(dist, 'data', 'seo', 'editorial');

async function readJson(relative) {
  return JSON.parse(await readFile(path.join(dist, relative), 'utf8'));
}

async function countJsonFiles(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) total += await countJsonFiles(target);
    else if (entry.isFile() && entry.name.endsWith('.json')) total += 1;
  }
  return total;
}

await access(path.join(editorialRoot, 'manifest.json'));
const manifest = await readJson('data/seo/editorial/manifest.json');
if (Number(manifest.candidate_records) < 10_000) throw new Error(`Cobertura editorial inesperada: ${manifest.candidate_records}.`);
if (Number(manifest.pages) < 100) throw new Error(`Poucas páginas agregadoras geradas: ${manifest.pages}.`);
if (!Array.isArray(manifest.routes) || manifest.routes.length !== Number(manifest.pages)) throw new Error('Manifest editorial possui rotas inconsistentes.');
if (new Set(manifest.routes).size !== manifest.routes.length) throw new Error('Manifest editorial possui rotas duplicadas.');
if (manifest.rules?.default_order !== 'Nome A–Z' || manifest.rules?.ranking !== false || manifest.rules?.recommendation !== false) {
  throw new Error('Regras de neutralidade/ordenação do SEO editorial não foram preservadas.');
}

const requiredSamples = [
  'data/seo/editorial/pages/deputado-federal/index.json',
  'data/seo/editorial/pages/deputado-federal/sp/index.json',
  'data/seo/editorial/pages/deputado-estadual/sp/index.json',
];
for (const relative of requiredSamples) await access(path.join(dist, relative));

const federalRoot = await readJson(requiredSamples[0]);
const federalSp = await readJson(requiredSamples[1]);
const stateSp = await readJson(requiredSamples[2]);
if (federalRoot.candidates_complete !== false || federalRoot.candidates.length > 60) throw new Error('Página nacional de Deputado Federal deve usar amostra A–Z de até 60 registros.');
if (stateSp.candidates_complete !== true || !stateSp.candidates.length) throw new Error('Página estadual de SP deve publicar o conjunto completo do recorte.');
if (!federalSp.facets?.parties?.length) throw new Error('Página Deputado Federal/SP não possui navegação por partido.');

const partySample = federalSp.facets.parties[0];
if (!partySample?.href?.startsWith('/candidatos/deputado-federal/sp/partido/')) throw new Error('Link partidário do recorte UF está inválido.');
const partyAsset = partySample.href.replace('/candidatos/', 'data/seo/editorial/pages/').replace('/partido/', '/partido/') + '.json';
const normalizedPartyAsset = partyAsset.replace('/sp/partido/', '/sp/partido/');
await access(path.join(dist, normalizedPartyAsset));

for (const page of [federalRoot, federalSp, stateSp]) {
  const names = page.candidates.map((candidate) => candidate.nome_urna || candidate.nome || '');
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  if (names.some((name, index) => name !== sorted[index])) throw new Error(`Página ${page.route} não está em ordem Nome A–Z.`);
  if (page.candidates.some((candidate) => !candidate.profile_path?.startsWith('/candidato/'))) throw new Error(`Página ${page.route} possui link de perfil inválido.`);
}

const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8');
for (const route of [federalRoot.route, federalSp.route, partySample.href]) {
  if (!sitemap.includes(`<loc>https://eleicoes-2026-ebz.pages.dev${route}</loc>`)) throw new Error(`Sitemap não inclui rota editorial ${route}.`);
}

const generatedJsonFiles = await countJsonFiles(editorialRoot);
if (generatedJsonFiles !== Number(manifest.pages) + 1) throw new Error(`Arquivos editoriais inesperados: ${generatedJsonFiles} para ${manifest.pages} páginas + manifest.`);

const functionSource = await readFile(path.join(root, 'functions/candidatos/[[path]].js'), 'utf8');
for (const marker of ['HTMLRewriter', 'parseEditorialRoute', 'canonicalEditorialPath', 'noindex,nofollow', 'data/seo/editorial/pages']) {
  if (!functionSource.includes(marker)) throw new Error(`Pages Function editorial sem marcador obrigatório: ${marker}`);
}
const appEntry = await readFile(path.join(root, 'src/appEntry.jsx'), 'utf8');
if (!appEntry.includes('EditorialDirectory') || !appEntry.includes('/^\\/candidatos')) throw new Error('Frontend não roteia agregadores editoriais.');

console.log(`SEO editorial validado: ${manifest.pages.toLocaleString('pt-BR')} páginas, ${manifest.candidate_records.toLocaleString('pt-BR')} candidaturas e ${generatedJsonFiles} JSONs editoriais.`);
