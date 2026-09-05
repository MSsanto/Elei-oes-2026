import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dataRoot = path.join(root, 'public', 'data');
const candidateRoot = path.join(dataRoot, 'candidatos');
const outputRoot = path.join(dataRoot, 'seo', 'candidatos');
const sitemapPath = path.join(root, 'public', 'sitemap.xml');
const robotsPath = path.join(root, 'public', 'robots.txt');
const SITE_ORIGIN = String(process.env.PUBLIC_SITE_ORIGIN || 'https://eleicoes-2026-ebz.pages.dev').replace(/\/+$/, '');

const CARGO_LABELS = {
  presidente: 'Presidente',
  governador: 'Governador',
  senador: 'Senador',
  'deputado-federal': 'Deputado Federal',
  'deputado-estadual': 'Deputado Estadual / Distrital',
};
const UF_REQUIRED = new Set(['governador', 'senador', 'deputado-estadual']);
const SKIP_DIRS = new Set(['cards']);
const SKIP_FILES = new Set(['manifest.json', 'search-index.json']);

function text(value = '') {
  return String(value ?? '').trim();
}

function publicValue(value = '') {
  const normalized = text(value);
  return normalized && !normalized.startsWith('#') ? normalized : '';
}

function candidateShard(id) {
  const normalized = text(id).replace(/\D/g, '');
  if (!normalized) throw new Error('Identificador TSE inválido para shard SEO.');
  return normalized.slice(-2).padStart(2, '0');
}

function canonicalPath(candidate) {
  const id = encodeURIComponent(candidate.id_tse);
  const params = new URLSearchParams();
  params.set('cargo', candidate.cargo_slug);
  if (UF_REQUIRED.has(candidate.cargo_slug) && candidate.uf) params.set('uf', candidate.uf);
  return `/candidato/${id}?${params.toString()}`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function normalizeCandidate(raw, inferredCargo = '') {
  const id = text(raw?.id_tse || raw?.sq_candidato || raw?.SQ_CANDIDATO);
  if (!/^\d+$/.test(id)) return null;

  const cargoSlug = text(raw?.cargo_slug || inferredCargo).toLowerCase();
  if (!CARGO_LABELS[cargoSlug]) return null;

  const candidate = {
    id_tse: id,
    ano_eleicao: text(raw?.ano_eleicao || '2026'),
    cargo_slug: cargoSlug,
    cargo: text(raw?.cargo) || CARGO_LABELS[cargoSlug],
    uf: text(raw?.uf).toUpperCase(),
    numero: text(raw?.numero),
    nome: text(raw?.nome),
    nome_urna: text(raw?.nome_urna),
    partido: text(raw?.partido),
    ocupacao: publicValue(raw?.ocupacao),
    situacao_candidatura: publicValue(raw?.situacao_candidatura),
    foto_url: /^https:\/\//i.test(text(raw?.foto_url)) ? text(raw?.foto_url) : '',
    ultima_atualizacao_tse: text(raw?.ultima_atualizacao_tse),
  };

  if (!candidate.nome && !candidate.nome_urna) return null;
  return candidate;
}

function mergeCandidate(existing, incoming) {
  if (!existing) return incoming;
  if (existing.cargo_slug !== incoming.cargo_slug) {
    throw new Error(`SQ_CANDIDATO ${incoming.id_tse} apareceu em cargos diferentes: ${existing.cargo_slug} e ${incoming.cargo_slug}.`);
  }
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (!merged[key] && value) merged[key] = value;
  }
  return merged;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function collectJsonFiles(directory, files = []) {
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await collectJsonFiles(path.join(directory, entry.name), files);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.json') || SKIP_FILES.has(entry.name)) continue;
    files.push(path.join(directory, entry.name));
  }
  return files;
}

function inferCargo(filePath) {
  const relative = path.relative(candidateRoot, filePath).split(path.sep);
  return relative[0] || '';
}

async function addPayload(map, payload, inferredCargo) {
  if (!Array.isArray(payload)) return;
  for (const raw of payload) {
    const normalized = normalizeCandidate(raw, inferredCargo);
    if (!normalized) continue;
    map.set(normalized.id_tse, mergeCandidate(map.get(normalized.id_tse), normalized));
  }
}

async function collectCandidates() {
  const candidates = new Map();

  const federalPath = path.join(dataRoot, 'deputados_federais.json');
  try {
    await addPayload(candidates, await readJson(federalPath), 'deputado-federal');
  } catch (error) {
    console.warn(`Base federal não entrou no índice SEO: ${error.message}`);
  }

  const files = await collectJsonFiles(candidateRoot);
  for (const filePath of files) {
    let payload;
    try {
      payload = await readJson(filePath);
    } catch (error) {
      throw new Error(`JSON inválido durante geração SEO: ${path.relative(root, filePath)} (${error.message})`);
    }
    await addPayload(candidates, payload, inferCargo(filePath));
  }

  return [...candidates.values()].sort((a, b) => a.id_tse.localeCompare(b.id_tse));
}

function candidateUrl(candidate) {
  return `${SITE_ORIGIN}${canonicalPath(candidate)}`;
}

function validLastMod(value) {
  const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

async function writeShards(candidates) {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  const shards = new Map();
  for (const candidate of candidates) {
    const shard = candidateShard(candidate.id_tse);
    if (!shards.has(shard)) shards.set(shard, {});
    shards.get(shard)[candidate.id_tse] = candidate;
  }

  const shardManifest = [];
  for (const [shard, records] of [...shards.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    await writeFile(path.join(outputRoot, `${shard}.json`), JSON.stringify(records), 'utf8');
    shardManifest.push({ shard, records: Object.keys(records).length });
  }

  const manifest = {
    version: 1,
    generated_at_utc: new Date().toISOString(),
    source: 'Bases processadas do TSE publicadas pelo projeto',
    site_origin: SITE_ORIGIN,
    records: candidates.length,
    shard_strategy: 'dois últimos dígitos do SQ_CANDIDATO',
    shards: shardManifest,
  };
  await writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

async function writeSitemap(candidates) {
  const staticUrls = ['/', '/metodologia', '/fontes', '/sobre', '/radar', '/siga-o-dinheiro'];
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];

  for (const pathname of staticUrls) {
    lines.push('  <url>', `    <loc>${escapeXml(`${SITE_ORIGIN}${pathname}`)}</loc>`, '  </url>');
  }
  for (const candidate of candidates) {
    lines.push('  <url>', `    <loc>${escapeXml(candidateUrl(candidate))}</loc>`);
    const lastmod = validLastMod(candidate.ultima_atualizacao_tse);
    if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push('  </url>');
  }

  lines.push('</urlset>', '');
  await writeFile(sitemapPath, lines.join('\n'), 'utf8');
  await writeFile(robotsPath, `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`, 'utf8');
}

const candidates = await collectCandidates();
if (!candidates.length) {
  console.warn('Nenhuma candidatura disponível para SEO; sitemap conterá apenas páginas institucionais.');
}
const manifest = await writeShards(candidates);
await writeSitemap(candidates);
console.log(`SEO de candidaturas: ${manifest.records.toLocaleString('pt-BR')} perfis em ${manifest.shards.length} shards + sitemap.xml.`);
