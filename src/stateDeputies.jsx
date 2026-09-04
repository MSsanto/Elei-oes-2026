import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { displayTseValue } from './chamberProfile.jsx';
import './stateDeputies.css';

const BASE_URL = '/data/candidatos/deputado-estadual';
const DEFAULT_BATCH = 60;

const REGIONS = {
  Norte: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'],
  Nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MT', 'MS'],
  Sudeste: ['ES', 'MG', 'RJ', 'SP'],
  Sul: ['PR', 'RS', 'SC'],
};

const ALL_UFS = Object.values(REGIONS).flat();

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function displayName(candidate) {
  return candidate?.nome_urna || candidate?.nome || 'Candidato sem nome';
}

function formatDate(value) {
  if (!value) return 'Aguardando coleta';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function setUrlParam(name, value) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  window.history.replaceState({}, '', url);
}

function initialRegion() {
  const value = new URLSearchParams(window.location.search).get('regiao') || '';
  return REGIONS[value] ? value : '';
}

function compareCandidates(a, b, sortBy) {
  const byName = () => displayName(a).localeCompare(displayName(b), 'pt-BR', { sensitivity: 'base' });
  if (sortBy === 'numero') {
    return String(a.numero || '').localeCompare(String(b.numero || ''), 'pt-BR', { numeric: true }) || byName();
  }
  if (sortBy === 'partido') {
    return String(a.partido || '').localeCompare(String(b.partido || ''), 'pt-BR', { sensitivity: 'base' }) || byName();
  }
  return byName();
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || '?';
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.7 15.7 8m-7.2 3.3 7.2 4.7M18 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM8 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10 6.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />
    </svg>
  );
}

function Avatar({ candidate }) {
  const [failed, setFailed] = useState(false);
  const source = failed ? '' : candidate.foto_url;
  return (
    <div className="avatar" aria-hidden="true">
      {source ? (
        <img src={source} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : initials(displayName(candidate))}
    </div>
  );
}

function StateCandidateCard({ candidate, onOpen, onShare, opening }) {
  const situation = displayTseValue(candidate.situacao_candidatura);
  return (
    <article className="candidate-card state-deputy-card">
      <button
        className="candidate-card-open"
        onClick={() => onOpen(candidate)}
        type="button"
        disabled={opening}
        aria-label={`Abrir perfil de ${displayName(candidate)}`}
      >
        <Avatar candidate={candidate} />
        <div className="candidate-main">
          <div className="candidate-topline">
            <span className="number">{candidate.numero || '—'}</span>
            <span className="party">{candidate.partido || 'Sem partido informado'}</span>
            <span className="uf">{candidate.uf || '—'}</span>
          </div>
          <h3>{displayName(candidate)}</h3>
          <p>{candidate.nome && candidate.nome !== candidate.nome_urna ? candidate.nome : candidate.cargo}</p>
          <div className="tags">
            {situation && <span>{situation}</span>}
            {candidate.ocupacao && <span>{candidate.ocupacao}</span>}
          </div>
        </div>
      </button>
      <button className="candidate-share" onClick={() => onShare(candidate)} type="button" aria-label={`Compartilhar perfil de ${displayName(candidate)}`}>
        <ShareIcon />
      </button>
    </article>
  );
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { cache: 'no-cache', signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function pageFile(page) {
  return String(page).padStart(3, '0');
}

export default function StateDeputiesView({
  uf,
  setUf,
  query,
  setQuery,
  party,
  setParty,
  occupation,
  setOccupation,
  sortBy,
  setSortBy,
  onOpen,
  onShare,
}) {
  const [region, setRegion] = useState(initialRegion);
  const [rootManifest, setRootManifest] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [pages, setPages] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const [index, setIndex] = useState(null);
  const [status, setStatus] = useState(uf ? 'loading' : 'needs-uf');
  const [indexStatus, setIndexStatus] = useState('idle');
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(DEFAULT_BATCH);
  const [openingId, setOpeningId] = useState('');
  const sentinelRef = useRef(null);
  const abortRef = useRef(null);
  const indexPromiseRef = useRef(null);
  const profileCacheRef = useRef(new Map());

  useEffect(() => {
    const controller = new AbortController();
    fetchJson(`${BASE_URL}/manifest.json`, controller.signal)
      .then(setRootManifest)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setUrlParam('regiao', region);
    if (region && uf && !REGIONS[region].includes(uf)) setUf('');
  }, [region, uf, setUf]);

  const availableUfs = useMemo(() => region ? REGIONS[region] : ALL_UFS, [region]);

  useEffect(() => {
    abortRef.current?.abort();
    indexPromiseRef.current = null;
    profileCacheRef.current.clear();
    setManifest(null);
    setPages({});
    setCurrentPage(0);
    setIndex(null);
    setIndexStatus('idle');
    setVisibleCount(DEFAULT_BATCH);
    setError('');

    if (!uf) {
      setStatus('needs-uf');
      return undefined;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');

    Promise.all([
      fetchJson(`${BASE_URL}/${uf}/manifest.json`, controller.signal),
      fetchJson(`${BASE_URL}/${uf}/cards/001.json`, controller.signal),
    ])
      .then(([ufManifest, firstPage]) => {
        setManifest(ufManifest);
        setPages({ 1: firstPage });
        setCurrentPage(1);
        setStatus('ready');
      })
      .catch((fetchError) => {
        if (fetchError.name === 'AbortError') return;
        setError(fetchError.message);
        setStatus('error');
      });

    return () => controller.abort();
  }, [uf]);

  const ensureIndex = useCallback(async () => {
    if (!uf) return [];
    if (index) return index;
    if (indexPromiseRef.current) return indexPromiseRef.current;
    setIndexStatus('loading');
    const signal = abortRef.current?.signal;
    const promise = fetchJson(`${BASE_URL}/${uf}/search-index.json`, signal)
      .then((payload) => {
        setIndex(payload);
        setIndexStatus('ready');
        return payload;
      })
      .catch((fetchError) => {
        if (fetchError.name !== 'AbortError') {
          setIndexStatus('error');
          setError(fetchError.message);
        }
        throw fetchError;
      })
      .finally(() => { indexPromiseRef.current = null; });
    indexPromiseRef.current = promise;
    return promise;
  }, [uf, index]);

  const indexMode = Boolean(query.trim() || party || occupation || sortBy !== 'nome');

  useEffect(() => {
    if (status === 'ready' && indexMode) ensureIndex().catch(() => {});
  }, [status, indexMode, ensureIndex]);

  useEffect(() => {
    setVisibleCount(DEFAULT_BATCH);
  }, [query, party, occupation, sortBy, uf]);

  const filteredIndex = useMemo(() => {
    if (!index) return [];
    const term = normalize(query.trim());
    return index
      .filter((candidate) => {
        if (party && candidate.partido !== party) return false;
        if (occupation && candidate.ocupacao !== occupation) return false;
        if (!term) return true;
        return [candidate.nome, candidate.nome_urna, candidate.numero, candidate.partido, candidate.ocupacao]
          .some((value) => normalize(value).includes(term));
      })
      .sort((a, b) => compareCandidates(a, b, sortBy));
  }, [index, query, party, occupation, sortBy]);

  const defaultCandidates = useMemo(
    () => Object.keys(pages).map(Number).sort((a, b) => a - b).flatMap((page) => pages[page] || []),
    [pages],
  );

  const visibleCandidates = indexMode
    ? filteredIndex.slice(0, visibleCount)
    : defaultCandidates;

  const totalResults = indexMode
    ? (index ? filteredIndex.length : manifest?.total || 0)
    : manifest?.total || 0;

  const hasMore = indexMode
    ? Boolean(index && visibleCount < filteredIndex.length)
    : Boolean(manifest && currentPage < manifest.page_count);

  const loadNext = useCallback(async () => {
    if (!hasMore || status !== 'ready') return;
    if (indexMode) {
      setVisibleCount((current) => Math.min(current + DEFAULT_BATCH, filteredIndex.length));
      return;
    }
    const nextPage = currentPage + 1;
    if (pages[nextPage]) {
      setCurrentPage(nextPage);
      return;
    }
    try {
      const payload = await fetchJson(`${BASE_URL}/${uf}/cards/${pageFile(nextPage)}.json`, abortRef.current?.signal);
      setPages((current) => ({ ...current, [nextPage]: payload }));
      setCurrentPage(nextPage);
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') setError(fetchError.message);
    }
  }, [hasMore, status, indexMode, filteredIndex.length, currentPage, pages, uf]);

  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver === 'undefined') return undefined;
    const target = sentinelRef.current;
    if (!target) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNext();
      },
      { rootMargin: '650px 0px', threshold: 0.01 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadNext]);

  const openFullProfile = useCallback(async (candidate) => {
    if (!candidate?.id_tse || !candidate?.pagina || !uf) {
      onOpen(candidate);
      return;
    }
    const cacheKey = `${uf}-${candidate.pagina}`;
    setOpeningId(String(candidate.id_tse));
    try {
      let chunk = profileCacheRef.current.get(cacheKey);
      if (!chunk) {
        chunk = await fetchJson(`${BASE_URL}/${uf}/perfis/${pageFile(candidate.pagina)}.json`, abortRef.current?.signal);
        profileCacheRef.current.set(cacheKey, chunk);
      }
      const full = chunk.find((item) => String(item.id_tse) === String(candidate.id_tse)) || candidate;
      onOpen(full);
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') onOpen(candidate);
    } finally {
      setOpeningId('');
    }
  }, [uf, onOpen]);

  useEffect(() => {
    if (status !== 'ready' || !uf) return;
    const candidateId = new URLSearchParams(window.location.search).get('candidato');
    if (!candidateId) return;
    let cancelled = false;
    ensureIndex()
      .then((payload) => {
        if (cancelled) return;
        const match = payload.find((item) => String(item.id_tse) === candidateId);
        if (match) openFullProfile(match);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [status, uf, ensureIndex, openFullProfile]);

  function clearSecondaryFilters() {
    setQuery('');
    setParty('');
    setOccupation('');
    setSortBy('nome');
  }

  const parties = manifest?.partidos || [];
  const occupations = manifest?.ocupacoes || [];
  const hasSecondaryFilters = Boolean(query.trim() || party || occupation || sortBy !== 'nome');
  const selectedLabel = uf === 'DF' ? 'Deputado Distrital' : 'Deputado Estadual';

  return (
    <>
      <section className="stats-wrap" aria-label="Resumo dos dados estaduais">
        <div className="stat-card"><strong>{manifest ? manifest.total.toLocaleString('pt-BR') : '—'}</strong><span>candidaturas na UF</span></div>
        <div className="stat-card"><strong>{uf || 'Escolha uma UF'}</strong><span>circunscrição da consulta</span></div>
        <div className="stat-card"><strong>{manifest ? parties.length.toLocaleString('pt-BR') : '—'}</strong><span>partidos nesta carga</span></div>
        <div className="stat-card stat-update"><strong>Atualização</strong><span>{formatDate(manifest?.generated_at_utc || rootManifest?.generated_at_utc)}</span></div>
      </section>

      <section className="content-section state-deputies-section">
        <div className="section-heading">
          <div><span className="section-kicker">CANDIDATURAS 2026</span><h2>{selectedLabel}</h2></div>
          <p>{status === 'ready' ? `${totalResults.toLocaleString('pt-BR')} resultado(s)` : 'Escolha uma UF para iniciar a consulta leve'}</p>
        </div>

        <div className="state-territory-row">
          <label>
            <span>Região</span>
            <select value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="">Todas as regiões</option>
              {Object.keys(REGIONS).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>UF obrigatória</span>
            <select value={uf} onChange={(event) => setUf(event.target.value)}>
              <option value="">Escolha uma UF</option>
              {availableUfs.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className="state-load-note">
            <strong>Carregamento sob demanda</strong>
            <span>Somente os dados da UF escolhida e os lotes próximos à tela são baixados.</span>
          </div>
        </div>

        <div className="filters filters-enhanced state-deputy-filters">
          <label className="search-box">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Nome, número, partido ou ocupação..."
              value={query}
              disabled={status !== 'ready'}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select value={party} onChange={(event) => setParty(event.target.value)} disabled={status !== 'ready'} aria-label="Filtrar por partido">
            <option value="">Todos os partidos</option>
            {parties.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={occupation} onChange={(event) => setOccupation(event.target.value)} disabled={status !== 'ready'} aria-label="Filtrar por ocupação">
            <option value="">Todas as ocupações</option>
            {occupations.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} disabled={status !== 'ready'} aria-label="Ordenar resultados">
            <option value="nome">Nome A–Z</option>
            <option value="numero">Número do candidato</option>
            <option value="partido">Partido A–Z</option>
          </select>
          {hasSecondaryFilters && <button className="clear-button" type="button" onClick={clearSecondaryFilters}>Limpar</button>}
        </div>

        {status === 'needs-uf' && (
          <div className="state-card governor-empty-state">
            <div className="empty-state-icon" aria-hidden="true">⌖</div>
            <strong>Escolha uma UF para consultar {selectedLabel}</strong>
            <span>A base nacional não é carregada no navegador. Região funciona apenas como atalho para a escolha da UF.</span>
          </div>
        )}
        {status === 'loading' && <div className="state-card"><div className="loader" />Carregando o primeiro lote de {uf}...</div>}
        {status === 'error' && <div className="state-card waiting"><strong>Não foi possível carregar a UF.</strong><span>{error}</span></div>}
        {indexStatus === 'loading' && indexMode && <div className="state-index-loading">Preparando índice local de busca de {uf}…</div>}

        {status === 'ready' && indexMode && indexStatus === 'ready' && filteredIndex.length === 0 && (
          <div className="state-card search-empty-state">
            <div className="empty-state-icon" aria-hidden="true">⌕</div>
            <strong>Nenhuma candidatura encontrada</strong>
            <span>Verifique a grafia ou remova algum dos filtros aplicados.</span>
            <button className="empty-clear-button" onClick={clearSecondaryFilters} type="button">Limpar filtros</button>
          </div>
        )}

        {visibleCandidates.length > 0 && (
          <div className="candidate-list state-deputy-list">
            {visibleCandidates.map((candidate) => (
              <StateCandidateCard
                key={candidate.id_tse}
                candidate={candidate}
                onOpen={openFullProfile}
                onShare={onShare}
                opening={openingId === String(candidate.id_tse)}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <button ref={sentinelRef} className="clear-button result-limit state-load-more" onClick={loadNext} type="button">
            {indexMode
              ? `Mostrando ${visibleCandidates.length.toLocaleString('pt-BR')} de ${filteredIndex.length.toLocaleString('pt-BR')} · carregar mais`
              : `Lote ${currentPage} de ${manifest?.page_count || '—'} · carregar mais`}
          </button>
        )}

        {status === 'ready' && (
          <div className="state-performance-note">
            <strong>Modo leve ativo</strong>
            <span>
              A listagem inicial usa páginas de {manifest?.page_size || DEFAULT_BATCH} cards. O índice completo da UF só é carregado ao pesquisar, filtrar ou alterar a ordenação; os dados detalhados do perfil só são buscados ao abrir o candidato.
            </span>
          </div>
        )}
      </section>
    </>
  );
}
