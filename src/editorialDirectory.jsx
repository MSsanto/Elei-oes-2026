import React, { useEffect, useMemo, useState } from 'react';
import PlatformHeader from './PlatformHeader.jsx';
import './editorialDirectory.css';

const PAGE_SIZE = 60;

function parsePathname(pathname) {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (parts[0] !== 'candidatos' || !parts[1]) return null;
  const cargo = parts[1].toLowerCase();
  if (parts.length === 2) return { cargo, uf: '', partySlug: '' };
  if (parts.length === 3) return { cargo, uf: parts[2].toLowerCase(), partySlug: '' };
  if (parts.length === 4 && parts[2] === 'partido') return { cargo, uf: '', partySlug: parts[3].toLowerCase() };
  if (parts.length === 5 && parts[3] === 'partido') return { cargo, uf: parts[2].toLowerCase(), partySlug: parts[4].toLowerCase() };
  return null;
}

function assetPath(route) {
  if (!route) return '';
  if (route.uf && route.partySlug) return `/data/seo/editorial/pages/${route.cargo}/${route.uf}/partido/${route.partySlug}.json`;
  if (route.partySlug) return `/data/seo/editorial/pages/${route.cargo}/partido/${route.partySlug}.json`;
  if (route.uf) return `/data/seo/editorial/pages/${route.cargo}/${route.uf}/index.json`;
  return `/data/seo/editorial/pages/${route.cargo}/index.json`;
}

function updateMeta(page) {
  if (!page) return;
  document.title = page.title;
  let description = document.querySelector('meta[name="description"]');
  if (!description) {
    description = document.createElement('meta');
    description.name = 'description';
    document.head.appendChild(description);
  }
  description.content = page.description;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = page.canonical_url;
}

function CandidateRow({ candidate }) {
  const name = candidate.nome_urna || candidate.nome || 'Candidatura';
  const details = [candidate.partido, candidate.uf, candidate.numero && `nº ${candidate.numero}`].filter(Boolean);
  return (
    <li className="editorial-directory-candidate">
      <a href={candidate.profile_path}>
        <strong>{name}</strong>
        <span>{details.join(' · ')}</span>
      </a>
    </li>
  );
}

function FacetSection({ title, items, type }) {
  if (!items?.length) return null;
  return (
    <section className="editorial-directory-facet">
      <h2>{title}</h2>
      <div className="editorial-directory-facet-grid">
        {items.map((item) => (
          <a key={item.href} href={item.href}>
            <span>{type === 'uf' ? item.label : item.party}</span>
            <strong>{Number(item.count || 0).toLocaleString('pt-BR')}</strong>
          </a>
        ))}
      </div>
    </section>
  );
}

export default function EditorialDirectory() {
  const route = useMemo(() => parsePathname(window.location.pathname), []);
  const [page, setPage] = useState(null);
  const [status, setStatus] = useState('loading');
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!route) {
      setStatus('error');
      return undefined;
    }
    const controller = new AbortController();
    fetch(assetPath(route), { cache: 'no-cache', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        setPage(payload);
        updateMeta(payload);
        setStatus('ready');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Falha ao carregar diretório editorial.', error);
          setStatus('error');
        }
      });
    return () => controller.abort();
  }, [route]);

  if (status === 'loading') {
    return (
      <div className="editorial-directory-page">
        <PlatformHeader />
        <main className="editorial-directory-main"><p>Carregando diretório de candidaturas…</p></main>
      </div>
    );
  }

  if (status === 'error' || !page) {
    return (
      <div className="editorial-directory-page">
        <PlatformHeader />
        <main className="editorial-directory-main">
          <span className="editorial-directory-kicker">ELEIÇÕES 2026</span>
          <h1>Página não localizada.</h1>
          <p>Este recorte não está disponível na base editorial publicada.</p>
          <a className="editorial-directory-primary" href="/">Voltar à consulta</a>
        </main>
      </div>
    );
  }

  const candidates = Array.isArray(page.candidates) ? page.candidates : [];
  const shown = candidates.slice(0, visible);
  const canLoadMore = page.candidates_complete !== false && visible < candidates.length;

  return (
    <div className="editorial-directory-page">
      <PlatformHeader />
      <main className="editorial-directory-main">
        <nav className="editorial-directory-breadcrumb" aria-label="Breadcrumb">
          <a href="/">Início</a><span aria-hidden="true">›</span><a href="/">Candidaturas</a>
          {(page.parents || []).map((parent) => (
            <React.Fragment key={`${parent.href}-${parent.label}`}><span aria-hidden="true">›</span><a href={parent.href}>{parent.label}</a></React.Fragment>
          ))}
        </nav>

        <header className="editorial-directory-header">
          <span className="editorial-directory-kicker">DIRETÓRIO ELEITORAL</span>
          <h1>{page.heading}</h1>
          <p>{page.description}</p>
        </header>

        <section className="editorial-directory-summary" aria-label="Resumo do recorte">
          <div><strong>{Number(page.total_candidates || 0).toLocaleString('pt-BR')}</strong><span>candidaturas</span></div>
          <div><strong>{page.uf_name || 'Brasil'}</strong><span>recorte</span></div>
          <div><strong>{page.partido || 'Todos'}</strong><span>partido</span></div>
          <div><strong>Nome A–Z</strong><span>ordenação</span></div>
        </section>

        <FacetSection title="Navegar por UF" items={page.facets?.ufs} type="uf" />
        <FacetSection title="Navegar por partido" items={page.facets?.parties} type="party" />

        <section className="editorial-directory-list-section">
          <div className="editorial-directory-section-heading">
            <div><span className="editorial-directory-kicker">CANDIDATURAS</span><h2>Lista alfabética</h2></div>
            <span>{Number(page.total_candidates || 0).toLocaleString('pt-BR')} no recorte</span>
          </div>

          {page.candidates_complete === false && (
            <div className="editorial-directory-note">
              A página nacional mostra uma amostra inicial de 60 nomes em ordem alfabética. Use os recortes por UF ou partido acima para navegar por subconjuntos completos.
            </div>
          )}

          {shown.length ? <ol className="editorial-directory-list">{shown.map((candidate) => <CandidateRow candidate={candidate} key={candidate.id_tse} />)}</ol> : <p>Nenhuma candidatura localizada neste recorte.</p>}
          {canLoadMore && <button className="editorial-directory-load" type="button" onClick={() => setVisible((value) => value + PAGE_SIZE)}>Carregar mais</button>}
        </section>

        <aside className="editorial-directory-method">
          <strong>Como ler esta página</strong>
          <p>Os nomes seguem ordem alfabética. Quantidades e agrupamentos são descritivos; não representam ranking, popularidade, recomendação ou avaliação política.</p>
          <p><a href="/metodologia">Metodologia</a> · <a href="/fontes">Fontes</a> · <a href="/">Consulta completa</a></p>
        </aside>
      </main>
    </div>
  );
}
