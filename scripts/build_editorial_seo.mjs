import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const candidateSeoRoot = path.join(root, 'public', 'data', 'seo', 'candidatos');
const outputRoot = path.join(root, 'public', 'data', 'seo', 'editorial');
const pagesRoot = path.join(outputRoot, 'pages');
const sitemapPath = path.join(root, 'public', 'sitemap.xml');
const SITE_ORIGIN = String(process.env.PUBLIC_SITE_ORIGIN || 'https://eleicoes-2026-ebz.pages.dev').replace(/\/+$/, '');
const ROOT_PREVIEW_LIMIT = 60;

const CARGO_CONFIG = {
  presidente: { label: 'Presidente', supportsUf: false },
  governador: { label: 'Governador', supportsUf: true },
  senador: { label: 'Senador', supportsUf: true },
  'deputado-federal': { label: 'Deputado Federal', supportsUf: true },
  'deputado-estadual': { label: 'Deputado Estadual / Distrital', supportsUf: true },
};

const UF_NAMES = {
  AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo',
  GO:'Goiás', MA:'Maranhão', MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais', PA:'Pará', PB:'Paraíba',
  PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RS:'Rio Grande do Sul',
  RO:'Rondônia', RR:'Roraima', SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins',
};

function text(value = '') {
  return String(value ?? '').trim();
}

function slugify(value = '') {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function candidateName(candidate) {
  return text(candidate.nome_urna || candidate.nome || 'Candidatura');
}

function compareCandidates(a, b) {
  return candidateName(a).localeCompare(candidateName(b), 'pt-BR', { sensitivity: 'base' })
    || text(a.numero).localeCompare(text(b.numero), 'pt-BR', { numeric: true });
}

function canonicalProfilePath(candidate) {
  const params = new URLSearchParams();
  params.set('cargo', candidate.cargo_slug);
  if (['governador', 'senador', 'deputado-estadual'].includes(candidate.cargo_slug) && candidate.uf) {
    params.set('uf', candidate.uf);
  }
  return `/candidato/${encodeURIComponent(candidate.id_tse)}?${params.toString()}`;
}

function routePath({ cargo, uf = '', partySlug = '' }) {
  let route = `/candidatos/${cargo}`;
  if (uf) route += `/${uf.toLowerCase()}`;
  if (partySlug) route += `/partido/${partySlug}`;
  return route;
}

function assetPathForRoute({ cargo, uf = '', partySlug = '' }) {
  if (uf && partySlug) return path.join(pagesRoot, cargo, uf.toLowerCase(), 'partido', `${partySlug}.json`);
  if (partySlug) return path.join(pagesRoot, cargo, 'partido', `${partySlug}.json`);
  if (uf) return path.join(pagesRoot, cargo, uf.toLowerCase(), 'index.json');
  return path.join(pagesRoot, cargo, 'index.json');
}

function compactCandidate(candidate) {
  return {
    id_tse: candidate.id_tse,
    nome: text(candidate.nome),
    nome_urna: text(candidate.nome_urna),
    numero: text(candidate.numero),
    partido: text(candidate.partido),
    uf: text(candidate.uf).toUpperCase(),
    cargo: text(candidate.cargo) || CARGO_CONFIG[candidate.cargo_slug]?.label || candidate.cargo_slug,
    cargo_slug: candidate.cargo_slug,
    profile_path: canonicalProfilePath(candidate),
  };
}

function groupCounts(candidates, field, mapper = (value) => value) {
  const counts = new Map();
  for (const candidate of candidates) {
    const raw = text(candidate[field]);
    if (!raw) continue;
    const key = mapper(raw);
    if (!key) continue;
    const current = counts.get(key) || { value: raw, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  return [...counts.entries()].map(([key, item]) => ({ key, ...item }));
}

function pageTitle({ cargo, uf = '', party = '' }) {
  const cargoLabel = CARGO_CONFIG[cargo]?.label || cargo;
  const details = [uf && `em ${UF_NAMES[uf] || uf}`, party && `pelo ${party}`].filter(Boolean).join(' ');
  return `Candidaturas para ${cargoLabel}${details ? ` ${details}` : ''} — Eleições 2026 | Transparência Eleitoral`;
}

function pageHeading({ cargo, uf = '', party = '' }) {
  const cargoLabel = CARGO_CONFIG[cargo]?.label || cargo;
  const details = [uf && `em ${UF_NAMES[uf] || uf}`, party && `pelo ${party}`].filter(Boolean).join(' ');
  return `Candidaturas para ${cargoLabel}${details ? ` ${details}` : ''}`;
}

function pageDescription({ cargo, uf = '', party = '' }) {
  const cargoLabel = CARGO_CONFIG[cargo]?.label || cargo;
  const scope = [uf && (UF_NAMES[uf] || uf), party].filter(Boolean).join(' · ');
  return `Lista factual de candidaturas para ${cargoLabel}${scope ? ` — ${scope}` : ''} nas Eleições 2026, organizada em ordem alfabética e baseada em dados públicos oficiais.`;
}

function buildFacets(candidates, page) {
  const config = CARGO_CONFIG[page.cargo];
  const ufs = config?.supportsUf
    ? groupCounts(candidates, 'uf', (value) => value.toUpperCase())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((item) => ({
        uf: item.key,
        label: UF_NAMES[item.key] || item.key,
        count: item.count,
        href: routePath({ cargo: page.cargo, uf: item.key, partySlug: page.partySlug }),
      }))
    : [];

  const parties = groupCounts(candidates, 'partido', slugify)
    .sort((a, b) => a.value.localeCompare(b.value, 'pt-BR', { sensitivity: 'base' }))
    .map((item) => ({
      party: item.value,
      slug: item.key,
      count: item.count,
      href: routePath({ cargo: page.cargo, uf: page.uf, partySlug: item.key }),
    }));

  return { ufs, parties };
}

function parentLinks(page) {
  const links = [{ label: CARGO_CONFIG[page.cargo]?.label || page.cargo, href: routePath({ cargo: page.cargo }) }];
  if (page.uf) links.push({ label: UF_NAMES[page.uf] || page.uf, href: routePath({ cargo: page.cargo, uf: page.uf }) });
  if (page.party) {
    links.push({ label: page.party, href: routePath({ cargo: page.cargo, partySlug: page.partySlug }) });
  }
  return links;
}

async function loadCandidates() {
  const files = (await readdir(candidateSeoRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^\d{2}\.json$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const candidates = [];
  for (const filename of files) {
    const payload = JSON.parse(await readFile(path.join(candidateSeoRoot, filename), 'utf8'));
    candidates.push(...Object.values(payload));
  }
  return candidates.filter((candidate) => CARGO_CONFIG[candidate.cargo_slug]).sort(compareCandidates);
}

async function writePage(scopeCandidates, page, { rootPreview = false } = {}) {
  const sorted = [...scopeCandidates].sort(compareCandidates);
  const complete = !rootPreview || sorted.length <= ROOT_PREVIEW_LIMIT;
  const visible = complete ? sorted : sorted.slice(0, ROOT_PREVIEW_LIMIT);
  const payload = {
    version: 1,
    generated_at_utc: new Date().toISOString(),
    route: routePath(page),
    canonical_url: `${SITE_ORIGIN}${routePath(page)}`,
    title: pageTitle(page),
    heading: pageHeading(page),
    description: pageDescription(page),
    cargo_slug: page.cargo,
    cargo: CARGO_CONFIG[page.cargo]?.label || page.cargo,
    uf: page.uf || '',
    uf_name: page.uf ? (UF_NAMES[page.uf] || page.uf) : '',
    partido: page.party || '',
    partido_slug: page.partySlug || '',
    total_candidates: sorted.length,
    candidates_complete: complete,
    candidates: visible.map(compactCandidate),
    facets: buildFacets(sorted, page),
    parents: parentLinks(page),
    ordering: 'Nome A–Z',
    source: 'TSE — Candidaturas 2026',
    source_url: 'https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026',
    methodology_url: '/metodologia',
  };

  const target = assetPathForRoute(page);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(payload), 'utf8');
  return payload;
}

function uniqueParties(candidates) {
  const bySlug = new Map();
  for (const candidate of candidates) {
    const party = text(candidate.partido);
    const partySlug = slugify(party);
    if (!party || !partySlug) continue;
    const previous = bySlug.get(partySlug);
    if (previous && previous !== party) {
      throw new Error(`Colisão de slug partidário: ${previous} e ${party} → ${partySlug}`);
    }
    bySlug.set(partySlug, party);
  }
  return [...bySlug.entries()].map(([partySlug, party]) => ({ partySlug, party }));
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function appendSitemap(routes) {
  const current = await readFile(sitemapPath, 'utf8');
  const closing = '</urlset>';
  if (!current.includes(closing)) throw new Error('sitemap.xml não possui fechamento </urlset>.');
  const additions = routes.map((route) => `  <url>\n    <loc>${escapeXml(`${SITE_ORIGIN}${route}`)}</loc>\n  </url>`).join('\n');
  const next = current.replace(closing, `${additions}\n${closing}`);
  await writeFile(sitemapPath, next, 'utf8');
}

const candidates = await loadCandidates();
if (!candidates.length) throw new Error('Índice SEO de candidaturas está vazio; agregadores editoriais não podem ser gerados.');

await rm(outputRoot, { recursive: true, force: true });
await mkdir(pagesRoot, { recursive: true });

const generated = [];
for (const [cargo, config] of Object.entries(CARGO_CONFIG)) {
  const cargoCandidates = candidates.filter((candidate) => candidate.cargo_slug === cargo);
  if (!cargoCandidates.length) continue;

  generated.push(await writePage(cargoCandidates, { cargo }, { rootPreview: config.supportsUf }));

  for (const { party, partySlug } of uniqueParties(cargoCandidates)) {
    const partyCandidates = cargoCandidates.filter((candidate) => slugify(candidate.partido) === partySlug);
    generated.push(await writePage(partyCandidates, { cargo, party, partySlug }));
  }

  if (!config.supportsUf) continue;
  const ufs = [...new Set(cargoCandidates.map((candidate) => text(candidate.uf).toUpperCase()).filter(Boolean))].sort();
  for (const uf of ufs) {
    const ufCandidates = cargoCandidates.filter((candidate) => text(candidate.uf).toUpperCase() === uf);
    generated.push(await writePage(ufCandidates, { cargo, uf }));
    for (const { party, partySlug } of uniqueParties(ufCandidates)) {
      const scoped = ufCandidates.filter((candidate) => slugify(candidate.partido) === partySlug);
      generated.push(await writePage(scoped, { cargo, uf, party, partySlug }));
    }
  }
}

const routes = generated.map((page) => page.route).sort();
await appendSitemap(routes);

const manifest = {
  version: 1,
  generated_at_utc: new Date().toISOString(),
  site_origin: SITE_ORIGIN,
  candidate_records: candidates.length,
  pages: generated.length,
  root_preview_limit: ROOT_PREVIEW_LIMIT,
  routes,
  route_types: {
    cargo: generated.filter((page) => !page.uf && !page.partido).length,
    cargo_uf: generated.filter((page) => page.uf && !page.partido).length,
    cargo_partido: generated.filter((page) => !page.uf && page.partido).length,
    cargo_uf_partido: generated.filter((page) => page.uf && page.partido).length,
  },
  rules: {
    default_order: 'Nome A–Z',
    ranking: false,
    recommendation: false,
    root_pages_with_uf_use_preview: true,
  },
};
await writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(`SEO editorial: ${manifest.pages.toLocaleString('pt-BR')} páginas agregadoras para ${manifest.candidate_records.toLocaleString('pt-BR')} candidaturas.`);
