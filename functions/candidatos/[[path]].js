const SITE_ORIGIN = 'https://eleicoes-2026-ebz.pages.dev';
const VALID_CARGOS = new Set(['presidente', 'governador', 'senador', 'deputado-federal', 'deputado-estadual']);
const VALID_UFS = new Set(['ac','al','ap','am','ba','ce','df','es','go','ma','mt','ms','mg','pa','pb','pr','pe','pi','rj','rn','rs','ro','rr','sc','sp','se','to']);

function text(value = '') {
  return String(value ?? '').trim();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function normalizeSegments(raw) {
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return segments.map((segment) => text(segment).toLowerCase()).filter(Boolean);
}

export function parseEditorialRoute(raw) {
  const parts = normalizeSegments(raw);
  if (!parts.length || !VALID_CARGOS.has(parts[0])) return null;
  const cargo = parts[0];
  if (parts.length === 1) return { cargo, uf: '', partySlug: '' };
  if (parts.length === 2 && VALID_UFS.has(parts[1])) return { cargo, uf: parts[1], partySlug: '' };
  if (parts.length === 3 && parts[1] === 'partido' && /^[a-z0-9-]+$/.test(parts[2])) {
    return { cargo, uf: '', partySlug: parts[2] };
  }
  if (parts.length === 4 && VALID_UFS.has(parts[1]) && parts[2] === 'partido' && /^[a-z0-9-]+$/.test(parts[3])) {
    return { cargo, uf: parts[1], partySlug: parts[3] };
  }
  return null;
}

export function canonicalEditorialPath(route) {
  let pathname = `/candidatos/${route.cargo}`;
  if (route.uf) pathname += `/${route.uf}`;
  if (route.partySlug) pathname += `/partido/${route.partySlug}`;
  return pathname;
}

export function editorialAssetPath(route) {
  if (route.uf && route.partySlug) return `/data/seo/editorial/pages/${route.cargo}/${route.uf}/partido/${route.partySlug}.json`;
  if (route.partySlug) return `/data/seo/editorial/pages/${route.cargo}/partido/${route.partySlug}.json`;
  if (route.uf) return `/data/seo/editorial/pages/${route.cargo}/${route.uf}/index.json`;
  return `/data/seo/editorial/pages/${route.cargo}/index.json`;
}

async function fetchShell(context) {
  const shellUrl = new URL('/', context.request.url);
  return context.env.ASSETS.fetch(new Request(shellUrl, { method: 'GET', headers: context.request.headers }));
}

async function fetchPage(context, route) {
  const url = new URL(editorialAssetPath(route), context.request.url);
  const response = await context.env.ASSETS.fetch(url);
  if (!response.ok) return null;
  return response.json();
}

function breadcrumbMarkup(page) {
  const links = ['<a href="/">Início</a>', '<span aria-hidden="true">›</span>', '<a href="/">Consultar candidaturas</a>'];
  for (const parent of page.parents || []) {
    links.push('<span aria-hidden="true">›</span>', `<a href="${escapeHtml(parent.href)}">${escapeHtml(parent.label)}</a>`);
  }
  return links.join(' ');
}

function facetMarkup(page) {
  const ufLinks = Array.isArray(page.facets?.ufs) ? page.facets.ufs : [];
  const partyLinks = Array.isArray(page.facets?.parties) ? page.facets.parties : [];
  const blocks = [];
  if (ufLinks.length) {
    blocks.push(`<section><h2>Por UF</h2><ul>${ufLinks.map((item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)} <span>(${Number(item.count || 0).toLocaleString('pt-BR')})</span></a></li>`).join('')}</ul></section>`);
  }
  if (partyLinks.length) {
    blocks.push(`<section><h2>Por partido</h2><ul>${partyLinks.map((item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.party)} <span>(${Number(item.count || 0).toLocaleString('pt-BR')})</span></a></li>`).join('')}</ul></section>`);
  }
  return blocks.join('');
}

function candidatesMarkup(page) {
  const candidates = Array.isArray(page.candidates) ? page.candidates : [];
  if (!candidates.length) return '<p>Nenhuma candidatura foi localizada para este recorte na carga publicada.</p>';
  const note = page.candidates_complete === false
    ? '<p>Esta página nacional mostra uma amostra inicial em ordem alfabética. Use os recortes por UF ou partido para navegar por subconjuntos completos.</p>'
    : '';
  const items = candidates.map((candidate) => {
    const name = candidate.nome_urna || candidate.nome || 'Candidatura';
    const details = [candidate.partido, candidate.uf, candidate.numero && `nº ${candidate.numero}`].filter(Boolean).join(' · ');
    return `<li><a href="${escapeHtml(candidate.profile_path)}"><strong>${escapeHtml(name)}</strong>${details ? `<span>${escapeHtml(details)}</span>` : ''}</a></li>`;
  }).join('');
  return `${note}<ol>${items}</ol>`;
}

function staticMarkup(page) {
  return `<main data-seo-prerender="editorial-directory" style="max-width:1100px;margin:0 auto;padding:32px 20px;font-family:Arial,sans-serif;color:#0b1f33">
    <nav aria-label="Breadcrumb" style="font-size:14px;margin-bottom:18px">${breadcrumbMarkup(page)}</nav>
    <article>
      <p style="font-size:13px;margin:0 0 10px">Eleições 2026 · Transparência Eleitoral</p>
      <h1 style="font-size:36px;line-height:1.12;margin:0 0 10px">${escapeHtml(page.heading)}</h1>
      <p>${escapeHtml(page.description)}</p>
      <p><strong>${Number(page.total_candidates || 0).toLocaleString('pt-BR')}</strong> candidaturas neste recorte · ordenação padrão: ${escapeHtml(page.ordering || 'Nome A–Z')}.</p>
      <div>${facetMarkup(page)}</div>
      <section><h2>Candidaturas</h2>${candidatesMarkup(page)}</section>
      <p>Dados públicos organizados a partir de fonte oficial. O projeto não atribui nota, ranking, popularidade ou recomendação a candidaturas.</p>
      <p><a href="/metodologia">Metodologia</a> · <a href="/fontes">Fontes</a> · <a href="/">Consulta geral</a></p>
    </article>
  </main>`;
}

function metadataHtml(page, canonicalUrl) {
  const title = text(page.title) || 'Candidaturas — Eleições 2026 | Transparência Eleitoral';
  const description = text(page.description) || 'Consulta factual de candidaturas das Eleições 2026 com fontes e metodologia identificadas.';
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
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
  ].join('');
}

async function rewriteShell(context, page, canonicalUrl) {
  const shell = await fetchShell(context);
  const transformed = new HTMLRewriter()
    .on('title', { element(element) { element.remove(); } })
    .on('meta[name="description"]', { element(element) { element.remove(); } })
    .on('meta[name="robots"]', { element(element) { element.remove(); } })
    .on('link[rel="canonical"]', { element(element) { element.remove(); } })
    .on('meta[property^="og:"]', { element(element) { element.remove(); } })
    .on('meta[name^="twitter:"]', { element(element) { element.remove(); } })
    .on('head', { element(element) { element.append(metadataHtml(page, canonicalUrl), { html: true }); } })
    .on('#root', { element(element) { element.setInnerContent(staticMarkup(page), { html: true }); } })
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
  const route = parseEditorialRoute(context.params?.path);
  if (!route) {
    return errorShell(context, 404, 'Página não localizada | Eleições 2026', 'O recorte editorial informado não existe na base publicada.');
  }

  let page;
  try {
    page = await fetchPage(context, route);
  } catch (error) {
    console.error('Falha ao carregar agregador SEO editorial.', error);
    return errorShell(context, 503, 'Página temporariamente indisponível | Eleições 2026', 'O agregador está temporariamente indisponível para carregamento.');
  }
  if (!page) {
    return errorShell(context, 404, 'Página não localizada | Eleições 2026', 'Não há página agregadora publicada para este recorte.');
  }

  const requestUrl = new URL(context.request.url);
  const canonicalPath = canonicalEditorialPath(route);
  if (requestUrl.pathname.replace(/\/+$/, '') !== canonicalPath || requestUrl.search) {
    return Response.redirect(new URL(canonicalPath, requestUrl.origin).toString(), 308);
  }

  const canonicalUrl = new URL(canonicalPath, SITE_ORIGIN).toString();
  return rewriteShell(context, page, canonicalUrl);
}
