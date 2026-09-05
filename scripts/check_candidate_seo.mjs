import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dist = path.join(root, 'dist');

async function readJson(relative) {
  return JSON.parse(await readFile(path.join(dist, relative), 'utf8'));
}

async function countFiles(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) total += await countFiles(path.join(directory, entry.name));
    else if (entry.isFile()) total += 1;
  }
  return total;
}

await access(path.join(dist, 'data/seo/candidatos/manifest.json'));
await access(path.join(dist, 'sitemap.xml'));
await access(path.join(dist, 'robots.txt'));

const seo = await readJson('data/seo/candidatos/manifest.json');
const cargos = await readJson('data/candidatos/manifest.json');
const federal = await readJson('data/metadata.json');

const expected = Number(federal.records || 0)
  + Number(cargos?.cargos?.presidente?.total || 0)
  + Number(cargos?.cargos?.governador?.total || 0)
  + Number(cargos?.cargos?.senador?.total || 0)
  + Number(cargos?.cargos?.['deputado-estadual']?.total || 0);

if (Number(seo.records) !== expected) {
  throw new Error(`Índice SEO inconsistente: ${seo.records} perfis gerados para ${expected} candidaturas esperadas.`);
}
if (!Array.isArray(seo.shards) || seo.shards.length < 90 || seo.shards.length > 100) {
  throw new Error(`Quantidade inesperada de shards SEO: ${seo.shards?.length}.`);
}

const firstShard = seo.shards.find((item) => Number(item.records) > 0)?.shard;
if (!firstShard) throw new Error('Nenhum shard SEO possui registros.');
const sampleShard = await readJson(`data/seo/candidatos/${firstShard}.json`);
const sample = Object.values(sampleShard)[0];
if (!sample?.id_tse || !sample?.cargo_slug || !(sample.nome_urna || sample.nome)) {
  throw new Error('Registro de amostra do índice SEO está incompleto.');
}

const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8');
const robots = await readFile(path.join(dist, 'robots.txt'), 'utf8');
if (!sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) {
  throw new Error('sitemap.xml não possui urlset válido.');
}
if (!sitemap.includes(`/candidato/${sample.id_tse}?cargo=${sample.cargo_slug}`)) {
  throw new Error('Perfil de amostra não apareceu no sitemap.xml.');
}
if (!robots.includes('Sitemap: https://eleicoes-2026-ebz.pages.dev/sitemap.xml')) {
  throw new Error('robots.txt não referencia o sitemap de produção.');
}

const staticFileCount = await countFiles(dist);
if (staticFileCount >= 20_000) {
  throw new Error(`Build gerou ${staticFileCount} arquivos estáticos e ultrapassa o limite de 20.000 arquivos do Cloudflare Pages Free.`);
}
if (staticFileCount >= 18_500) {
  console.warn(`Atenção: build já possui ${staticFileCount} arquivos estáticos; margem para o limite do Pages Free está reduzida.`);
}

const functionSource = await readFile(path.join(root, 'functions/candidato/[id].js'), 'utf8');
for (const marker of ['HTMLRewriter', 'canonicalCandidatePath', 'noindex,nofollow', 'data/seo/candidatos']) {
  if (!functionSource.includes(marker)) throw new Error(`Pages Function SEO sem marcador obrigatório: ${marker}`);
}

console.log(`SEO validado: ${seo.records.toLocaleString('pt-BR')} perfis, ${seo.shards.length} shards, sitemap e ${staticFileCount} arquivos estáticos no build.`);
