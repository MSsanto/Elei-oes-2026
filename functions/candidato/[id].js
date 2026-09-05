const SITE_ORIGIN = 'https://eleicoes-2026-ebz.pages.dev';
const UF_REQUIRED = new Set(['governador', 'senador', 'deputado-estadual']);
const EDITORIAL_UF_CARGOS = new Set(['governador', 'senador', 'deputado-federal', 'deputado-estadual']);
const VALID_TABS = new Set(['patrimonio', 'financas', 'camara']);

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

export function candidateShard(id) {
  const normalized = text(id).replace(/\D/g, '');
  return normalized.slice(-2).padStart(2, '0');
}

export function canonicalCandidatePath(candidate, requestedTab = '') {
  const params = new URLSearchParams();
  params.set('cargo', candidate.cargo_slug);
  if (UF_REQUIRED.has(candidate.cargo_slug) && candidate.uf) params.set('uf', candidate.uf);
  if (VALID_TABS.has(requestedTab)) params.set('aba', requestedTab);
  return `/candidato/${encodeURIComponent(candidate.id_tse)}?${params.toString()}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function cleanPublicValue(value) {
  const normalized = text(value);
  return normalized && !normalized.startsWith('#') ? normalized : '';
}

function candidateName(candidate) {
  return text(candidate.nome_urna || candidate.nome || 'Candidatura');
}

function candidateTitle(candidate) {
  const name = candidateName(candidate);
  const cargo = text(candidate.cargo || 'Candidatura');
  return `${name} — ${cargo} | Eleições 2026`;
}

function candidateDescription(candidate) {
  const name = candidateName(candidate);
  const cargo = text(candidate.cargo || 'candidatura');
  const party = text(candidate.partido);
  const uf = text(candidate.uf);
  const number = text(candidate.numero);
  const details = [party && `partido ${party}`, uf && `UF ${uf}`, number && `número ${number}`].filter(Boolean).join(', ');
  return `Perfil de ${name}, ${cargo}${details ? ` — ${details}` : ''}. Dados públicos eleitorais organizados com fonte e metodologia identificadas.`;
}

function editorialProfileLinks(candidate) {
  const cargo = text(candidate.cargo_slug);
  if (!cargo) return [];
  const links = [{ label: `Candidaturas para ${text(candidate.cargo || cargo)}`, href: `/candidatos/${cargo}` }];
  const uf = text(candidate.uf).toLowerCase();
  const party = text(candidate.partido);
  const partySlug = slugify(party);
  if (uf && EDITORIAL_UF_CARGOS.has(cargo)) {
    links.push({ label: `Candidaturas em ${text(candidate.uf).toUpperCase()}`, href: `/candidatos/${cargo}/${uf}` });
  }
  if (partySlug) {
    links.push({ label: `Candidaturas do ${party}`, href: `/candidatos/${cargo}/partido/${partySlug}` });
    if (uf && EDITORIAL_UF_CARGOS.has(cargo)) {
      links.push({ label: `${party} em ${text(candidate.uf).toUpperCase()}`, href: `/candidatos/${cargo}/${uf}/partido/${partySlug}` });
    }
  }
  return links;
}

async function fetchShell(context) {
  const shellUrl = new URL('/', context.request.url);
  return context.env.ASSETS.fetch(new Request(shellUrl, { method: 'GET', headers: context.request.headers }));
}

async function fetchCandidate(context, id) {
  const shard = candidateShard(id);
  const url = new URL(`/data/seo/candidatos/${shard}.json`, context.request.url);
  const response = await context.env.ASSETS.fetch(url);
  if (!response.ok) return null;
  const payload = await response.json();
  return payload && typeof payload === 'object' ? payload[id] || null : null;
}

function staticCandidateMarkup(candidate) {
  const name = candidateName(candidate);
  const fullName = text(candidate.nome);
  const cargo = text(candidate.cargo);
  const party = text(candidate.partido);
  const uf = text(candidate.uf);
  const number = text(candidate.numero);
  const occupation = cleanPublicValue(candidate.ocupacao);
  const situation = cleanPublicValue(candidate.situacao_candidatura);
  const editorialLinks = editorialProfileLinks(candidate);

  const facts = [
    cargo && `<li><strong>Cargo:</strong> ${escapeHtml(cargo)}</li>`,
    party && `<li><strong>Partido:</strong> ${escapeHtml(party)}</li>`,
    uf && `<li><strong>UF:</strong> ${escapeHtml(uf)}</li>`,
    number && `<li><strong>Número:</strong> ${escapeHtml(number)}</li>`,
    occupation && `<li><strong>Ocupação declarada:</strong> ${escapeHtml(occupation)}</li>`,
    situation && `<li><strong>Situação publicada:</strong> ${escapeHtml(situation)}</li>`,
  ].filter(Boolean).join('');

  const related = editorialLinks.length
    ? `<nav aria-label="Explorar candidaturas relacionadas"><strong>Explorar o mesmo recorte:</strong> ${editorialLinks.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join(' · ')}</nav>`
    : '';

  return `<main data-seo-prerender="candidate" style="max-width:900px;margin:0 auto;padding:32px 20px;font-family:Arial,sans-serif;color:#0b1f33">
    <p style="font-size:13px;margin:0 0 10px">Eleições 2026 · Transparência Eleitoral</p>
    <article>
      <h1 style="font-size:34px;line-height:1.12;margin:0 0 8px">${escapeHtml(name)}</h1>
      ${fullName && fullName !== name ? `<p style="margin:0 0 18px">Nome completo: ${escapeHtml(fullName)}</p>` : ''}
      <ul style="line-height:1.7;padding-left:20px">${facts}</ul>
      ${related}
      <p>Dados públicos organizados a partir de fontes oficiais. O projeto é independente e não atribui nota, ranking ou recomendação a candidaturas.</p>
      <p><a href="/metodologia">Metodologia</a> · <a href="/fontes">Fontes</a> · <a href="/">Consultar outras candidaturas</a></p>
    </article>
  </main>`;
}

function metadataHtml(candidate, canonicalUrl) {
  const title = candidateTitle(candidate);
  const description = candidateDescription(candidate);
  const image = /^https:\/\//i.test(text(candidate.foto_url)) ? text(candidate.foto_url) : '';
  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
    '<meta name="robots" content="index,follow,max-image-preview:large">',
    '<meta property="og:locale" content="pt_BR">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Eleições 2026 — Transparência Eleitoral">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
  ].filter(Boolean).join('');
}

async function rewriteCandidateShell(context, candidate, canonicalUrl) {
  const shell = await fetchShell(context);
  const transformed = new HTMLRewriter()
    .on('title', { element(element) { element.remove(); } })
    .on('meta[name="description"]', { element(element) { element.remove(); } })
    .on('meta[name="robots"]', { element(element) { element.remove(); } })
    .on('link[rel="canonical"]', { element(element) { element.remove(); } })
    .on('meta[property^="og:"]', { element(element) { element.remove(); } })
    .on('meta[name^="twitter:"]', { element(element) { element.remove(); } })
    .on('head', { element(element) { element.append(metadataHtml(candidate, canonicalUrl), { html: true }); } })
    .on('#root', { element(element) { element.setInnerContent(staticCandidateMarkup(candidate), { html: true }); } })
    .transform(shell);

  const headers = new Headers(transformed.headers);
  headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  headers.set('Content-Language', 'pt-BR');
  headers.set('Link', `<${canonicalUrl}>; rel="canonical"`);
  return new Response(transformed.body, { status: 200, headers });
}

async function errorShell(context, status, title, description) {
  const shell = await fetchShell(context);
  const transformed = new HTMLRewriter()
    .on('title', { element(element) { element.remove(); } })
    .on('meta[name="description"]', { element(element) { element.remove(); } })
    .on('head', { element(element) {
      element.append(`<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="noindex,nofollow">`, { html: true });
    } })
    .transform(shell);
  const headers = new Headers(transformed.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('Cache-Control', status === 404 ? 'public, max-age=60, s-maxage=300' : 'no-store');
  return new Response(transformed.body, { status, headers });
}

export async function onRequestGet(context) {
  const id = text(context.params?.id);
  if (!/^\d+$/.test(id)) {
    return errorShell(context, 404, 'Perfil não localizado | Eleições 2026', 'O identificador informado não corresponde a uma candidatura publicada nesta base.');
  }

  let candidate;
  try {
    candidate = await fetchCandidate(context, id);
  } catch (error) {
    console.error('Falha ao carregar índice SEO de candidatura.', error);
    return errorShell(context, 503, 'Perfil temporariamente indisponível | Eleições 2026', 'O perfil está temporariamente indisponível para carregamento.');
  }

  if (!candidate) {
    return errorShell(context, 404, 'Perfil não localizado | Eleições 2026', 'O identificador informado não foi encontrado na carga eleitoral publicada.');
  }

  const requestUrl = new URL(context.request.url);
  const requestedTab = requestUrl.searchParams.get('aba') || '';
  const routePath = canonicalCandidatePath(candidate, requestedTab);
  const desiredRequestUrl = new URL(routePath, requestUrl.origin);

  if (`${requestUrl.pathname}${requestUrl.search}` !== `${desiredRequestUrl.pathname}${desiredRequestUrl.search}`) {
    return Response.redirect(desiredRequestUrl.toString(), 308);
  }

  const canonicalUrl = new URL(routePath, SITE_ORIGIN).toString();
  return rewriteCandidateShell(context, candidate, canonicalUrl);
}
