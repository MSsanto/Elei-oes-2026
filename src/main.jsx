import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './photo.css';
import './autocomplete.css';
import './uxEnhancements.css';
import { ChamberActivity, chamberBasePhoto, displayTseValue } from './chamberProfile.jsx';

const DATA_URL = '/data/deputados_federais.json';
const META_URL = '/data/metadata.json';
const IDENTITY_URL = '/data/mappings/identidades.json';
const CHAMBER_HISTORY_URL = '/data/camara/historico_confirmados.json';
const LIVE_SP_URL = '/api/candidates?uf=SP&limit=120';
const REPOSITORY_URL = 'https://github.com/MSsanto/Elei-oes-2026';

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatDate(value) {
  if (!value) return 'Aguardando primeira coleta';
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

function formatBirthDate(value) {
  if (!value) return '';
  try {
    const raw = typeof value === 'number' || /^\d{10,13}$/.test(String(value))
      ? new Date(Number(value))
      : new Date(value);
    if (Number.isNaN(raw.getTime())) return String(value);
    return new Intl.DateTimeFormat('pt-BR').format(raw);
  } catch {
    return String(value);
  }
}

function uniqueSorted(items, field) {
  return [...new Set(items.map((item) => item[field]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' }),
  );
}

function displayName(candidate) {
  return candidate?.nome_urna || candidate?.nome || 'Candidato sem nome';
}

function compareCandidates(a, b, sortBy) {
  const byName = () => displayName(a).localeCompare(displayName(b), 'pt-BR', { sensitivity: 'base' });

  if (sortBy === 'numero') {
    const aNumber = Number(a.numero);
    const bNumber = Number(b.numero);
    if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) return aNumber - bNumber;
    return String(a.numero || '').localeCompare(String(b.numero || ''), 'pt-BR', { numeric: true }) || byName();
  }

  if (sortBy === 'partido') {
    const partyResult = String(a.partido || '').localeCompare(String(b.partido || ''), 'pt-BR', { sensitivity: 'base' });
    return partyResult || byName();
  }

  return byName();
}

function candidateProfileUrl(candidate) {
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  url.searchParams.set('candidato', String(candidate.id_tse));
  return url.toString();
}

function updateCandidateUrl(candidateId = '') {
  const url = new URL(window.location.href);
  if (candidateId) url.searchParams.set('candidato', String(candidateId));
  else url.searchParams.delete('candidato');
  window.history.replaceState({}, '', url);
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 .7A11.3 11.3 0 0 0 8.4 22.8c.6.1.8-.2.8-.5v-2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.2c0 .3.2.6.8.5A11.3 11.3 0 0 0 12 .7Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.7 15.7 8m-7.2 3.3 7.2 4.7M18 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM8 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10 6.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />
    </svg>
  );
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

function CandidateAvatar({ candidate, large = false }) {
  const sources = [candidate.foto_url, chamberBasePhoto(candidate)].filter((value, index, array) => value && array.indexOf(value) === index);
  const [sourceIndex, setSourceIndex] = useState(0);
  const name = displayName(candidate);
  const className = `avatar${large ? ' avatar-large' : ''}`;
  const source = sources[sourceIndex];

  if (source) {
    return (
      <div className={className} aria-hidden="true">
        <img
          src={source}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setSourceIndex((current) => current + 1)}
        />
      </div>
    );
  }
  return <div className={className} aria-hidden="true">{initials(name)}</div>;
}

function CandidateCard({ candidate, onOpen, onShare }) {
  const hasChamberHistory = candidate.identidade_camara?.historico_camara_localizado === true;
  const situation = displayTseValue(candidate.situacao_candidatura);

  return (
    <article className="candidate-card">
      <button className="candidate-card-open" onClick={() => onOpen(candidate)} type="button" aria-label={`Abrir perfil de ${displayName(candidate)}`}>
        <CandidateAvatar candidate={candidate} />
        <div className="candidate-main">
          <div className="candidate-topline">
            <span className="number">{candidate.numero || '—'}</span>
            <span className="party">{candidate.partido || 'Sem partido informado'}</span>
            <span className="uf">{candidate.uf || 'BR'}</span>
          </div>
          <h3>{displayName(candidate)}</h3>
          <p>{candidate.nome && candidate.nome !== candidate.nome_urna ? candidate.nome : 'Deputado Federal'}</p>
          <div className="tags">
            {situation && <span>{situation}</span>}
            {candidate.ocupacao && <span>{candidate.ocupacao}</span>}
            {hasChamberHistory && <span>Histórico na Câmara</span>}
          </div>
        </div>
      </button>
      <button
        className="candidate-share"
        onClick={() => onShare(candidate)}
        type="button"
        aria-label={`Compartilhar perfil de ${displayName(candidate)}`}
        title="Compartilhar perfil"
      >
        <ShareIcon />
      </button>
    </article>
  );
}

function CandidateModal({ candidate, onClose, onShare }) {
  if (!candidate) return null;
  const identity = candidate.identidade_camara;
  const confirmed = identity?.correspondencia_status === 'confirmada';

  const rows = [
    ['Nome completo', candidate.nome],
    ['Nome de urna', candidate.nome_urna],
    ['Número', candidate.numero],
    ['Partido', candidate.partido],
    ['UF', candidate.uf],
    ['Situação da candidatura', displayTseValue(candidate.situacao_candidatura)],
    ['Situação na urna', displayTseValue(candidate.situacao_urna)],
    ['Ocupação', candidate.ocupacao],
    ['Grau de instrução', candidate.grau_instrucao],
    ['Gênero', candidate.genero],
    ['Cor/raça declarada', candidate.cor_raca],
    ['Data de nascimento', formatBirthDate(candidate.data_nascimento)],
    ['Identificador TSE', candidate.id_tse],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="candidate-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close-button" onClick={onClose} type="button" aria-label="Fechar">×</button>
        <div className="modal-heading">
          <CandidateAvatar candidate={candidate} large />
          <div className="modal-heading-copy">
            <div className="candidate-topline">
              <span className="number">{candidate.numero || '—'}</span>
              <span className="party">{candidate.partido || '—'}</span>
              <span className="uf">{candidate.uf || '—'}</span>
            </div>
            <h2 id="candidate-title">{displayName(candidate)}</h2>
            <p>Dados oficiais consolidados por fonte</p>
          </div>
          <button className="modal-share-button" onClick={() => onShare(candidate)} type="button">
            <ShareIcon />
            Compartilhar
          </button>
        </div>

        {confirmed ? (
          <ChamberActivity candidate={candidate} identity={identity} />
        ) : (
          <div className="coming-soon">
            <strong>Histórico parlamentar não confirmado.</strong>{' '}
            O projeto só associa uma candidatura à Câmara quando a correspondência entre as fontes oficiais é segura pela metodologia publicada.
          </div>
        )}

        <div className="profile-section-title">Candidatura 2026</div>
        <dl className="detail-grid">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function attachOfficialSources(candidates, identityPayload, historyPayload) {
  const identityRecords = Array.isArray(identityPayload?.records) ? identityPayload.records : [];
  const byTseId = new Map();
  identityRecords.forEach((item) => {
    (item.tse_sq_candidato || []).forEach((id) => byTseId.set(String(id), item));
  });
  const chamberHistory = historyPayload?.deputados || {};

  return candidates.map((candidate) => {
    const identity = byTseId.get(String(candidate.id_tse)) || null;
    const chamberId = identity?.correspondencia_status === 'confirmada' ? identity.camara_id_deputado?.[0] : null;
    return {
      ...candidate,
      identidade_camara: identity,
      camara_base: chamberId ? chamberHistory[String(chamberId)] || null : null,
    };
  });
}

async function optionalJson(url) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function loadStaticData() {
  const [candidateResponse, metadataResponse, identityPayload, historyPayload] = await Promise.all([
    fetch(DATA_URL, { cache: 'no-cache' }),
    fetch(META_URL, { cache: 'no-cache' }),
    optionalJson(IDENTITY_URL),
    optionalJson(CHAMBER_HISTORY_URL),
  ]);

  if (!candidateResponse.ok) throw new Error('Falha ao carregar a base estática.');
  const rawCandidates = await candidateResponse.json();
  const metadata = metadataResponse.ok ? await metadataResponse.json() : null;
  const candidates = attachOfficialSources(Array.isArray(rawCandidates) ? rawCandidates : [], identityPayload, historyPayload);
  return { candidates, metadata };
}

async function loadLivePreview() {
  const response = await fetch(LIVE_SP_URL, { cache: 'no-cache' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
  return {
    candidates: Array.isArray(payload.candidates) ? payload.candidates : [],
    metadata: { source: payload.source, generated_at_utc: payload.generated_at_utc, records: payload.records, uf: payload.uf, election_id: payload.election_id, mode: 'live-cloudflare' },
  };
}

function App() {
  const [candidates, setCandidates] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [query, setQuery] = useState('');
  const [uf, setUf] = useState('');
  const [occupation, setOccupation] = useState('');
  const [party, setParty] = useState('');
  const [sortBy, setSortBy] = useState('nome');
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('loading');
  const [statusMessage, setStatusMessage] = useState('Carregando base pública...');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const staticData = await loadStaticData();
        if (!active) return;
        if (staticData.candidates.length > 0) {
          setCandidates(staticData.candidates);
          setMetadata(staticData.metadata);
          setStatus('ready');
          return;
        }
        setStatusMessage('Base estática ainda vazia. Consultando o TSE via Cloudflare...');
        const liveData = await loadLivePreview();
        if (!active) return;
        setCandidates(liveData.candidates);
        setMetadata(liveData.metadata);
        setStatus(liveData.candidates.length ? 'ready' : 'waiting');
      } catch (error) {
        console.error(error);
        if (!active) return;
        setStatus('waiting');
        setStatusMessage(`A coleta automática ainda está sendo ajustada: ${error.message}`);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (status !== 'ready' || candidates.length === 0) return;
    const candidateId = new URLSearchParams(window.location.search).get('candidato');
    if (!candidateId) return;
    const match = candidates.find((candidate) => String(candidate.id_tse) === candidateId);
    if (match) setSelected(match);
  }, [candidates, status]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setSelected(null);
        updateCandidateUrl('');
        setSuggestionsOpen(false);
        setActiveSuggestion(-1);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const ufs = useMemo(() => uniqueSorted(candidates, 'uf'), [candidates]);
  const occupations = useMemo(() => uniqueSorted(candidates, 'ocupacao'), [candidates]);
  const parties = useMemo(() => uniqueSorted(candidates, 'partido'), [candidates]);

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    const result = candidates.filter((candidate) => {
      if (uf && candidate.uf !== uf) return false;
      if (occupation && candidate.ocupacao !== occupation) return false;
      if (party && candidate.partido !== party) return false;
      if (!term) return true;
      return [candidate.nome, candidate.nome_urna, candidate.numero, candidate.partido, candidate.ocupacao]
        .some((value) => normalize(value).includes(term));
    });
    return result.sort((a, b) => compareCandidates(a, b, sortBy));
  }, [candidates, query, uf, occupation, party, sortBy]);

  const searchSuggestions = useMemo(() => {
    const term = normalize(query.trim());
    if (term.length < 2 || status !== 'ready') return [];
    const pool = candidates.filter((candidate) => (
      (!uf || candidate.uf === uf)
      && (!occupation || candidate.ocupacao === occupation)
      && (!party || candidate.partido === party)
    ));
    const candidateMatches = pool
      .filter((candidate) => [candidate.nome_urna, candidate.nome, candidate.numero, candidate.partido, candidate.ocupacao]
        .some((value) => normalize(value).includes(term)))
      .sort((a, b) => {
        const aName = normalize(displayName(a));
        const bName = normalize(displayName(b));
        return (aName.startsWith(term) ? 0 : 1) - (bName.startsWith(term) ? 0 : 1)
          || aName.localeCompare(bName, 'pt-BR');
      })
      .slice(0, 7)
      .map((candidate) => ({ type: 'candidate', key: `candidate-${candidate.id_tse}`, candidate }));
    const partyMatches = parties
      .filter((item) => normalize(item).includes(term))
      .slice(0, 3)
      .map((item) => ({
        type: 'party',
        key: `party-${item}`,
        party: item,
        count: candidates.filter((candidate) => (
          candidate.partido === item
          && (!uf || candidate.uf === uf)
          && (!occupation || candidate.ocupacao === occupation)
        )).length,
      }));
    return [...candidateMatches, ...partyMatches].slice(0, 10);
  }, [candidates, parties, query, uf, occupation, party, status]);

  useEffect(() => {
    setActiveSuggestion(-1);
    setSuggestionsOpen(query.trim().length >= 2 && searchSuggestions.length > 0);
  }, [query, searchSuggestions.length]);

  function openCandidate(candidate) {
    setSelected(candidate);
    updateCandidateUrl(candidate.id_tse);
  }

  function closeCandidate() {
    setSelected(null);
    updateCandidateUrl('');
  }

  async function shareCandidate(candidate) {
    const url = candidateProfileUrl(candidate);
    const title = `${displayName(candidate)} — Eleições 2026`;
    const details = [candidate.numero, candidate.partido, candidate.uf].filter(Boolean).join(' · ');
    const text = `${displayName(candidate)}${details ? ` — ${details}` : ''}. Perfil com dados oficiais no Eleições 2026.`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  function chooseSuggestion(suggestion) {
    if (!suggestion) return;
    if (suggestion.type === 'candidate') {
      setQuery(displayName(suggestion.candidate));
      openCandidate(suggestion.candidate);
    } else {
      setParty(suggestion.party);
      setQuery('');
    }
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  function handleSearchKeyDown(event) {
    if (!suggestionsOpen || !searchSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % searchSuggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((current) => (current <= 0 ? searchSuggestions.length - 1 : current - 1));
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(searchSuggestions[activeSuggestion]);
    } else if (event.key === 'Escape') {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
    }
  }

  function clearFilters() {
    setQuery('');
    setUf('');
    setOccupation('');
    setParty('');
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  const stats = useMemo(() => ({
    candidates: candidates.length,
    ufs: uniqueSorted(candidates, 'uf').length,
    chamberHistory: candidates.filter((item) => item.identidade_camara?.historico_camara_localizado).length,
  }), [candidates]);

  return (
    <>
      <header className="hero">
        <nav className="topbar" aria-label="Navegação principal">
          <a className="brand" href="#top" aria-label="Eleições 2026 — início">
            <span className="brand-mark">E26</span>
            <span><strong>Eleições 2026</strong><small>Transparência de dados públicos</small></span>
          </a>
          <a className="github-link" href={REPOSITORY_URL} target="_blank" rel="noreferrer" aria-label="Abrir repositório do projeto no GitHub">
            <GitHubIcon />
            <span>GitHub</span>
            <span aria-hidden="true">↗</span>
          </a>
        </nav>
        <div className="hero-content" id="top">
          <div className="eyebrow">DADOS PÚBLICOS · TSE · CÂMARA · CÓDIGO ABERTO</div>
          <h1>Da candidatura ao mandato,<br /><span>dados oficiais em um só lugar.</span></h1>
          <p className="hero-copy">Consulta independente das candidaturas a Deputado Federal em 2026, integrada progressivamente ao histórico parlamentar publicado pelas fontes oficiais.</p>
          <div className="trust-row"><span>Fontes oficiais identificadas</span><span>Sem vínculo partidário</span><span>Metodologia auditável</span></div>
        </div>
      </header>

      <main>
        <section className="stats-wrap" aria-label="Resumo dos dados">
          <div className="stat-card"><strong>{stats.candidates.toLocaleString('pt-BR')}</strong><span>candidaturas carregadas</span></div>
          <div className="stat-card"><strong>{stats.ufs}</strong><span>UFs nesta carga</span></div>
          <div className="stat-card"><strong>{stats.chamberHistory.toLocaleString('pt-BR')}</strong><span>históricos na Câmara confirmados</span></div>
          <div className="stat-card stat-update"><strong>Atualização</strong><span>{formatDate(metadata?.generated_at_utc)}</span></div>
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div><span className="section-kicker">CANDIDATURAS 2026</span><h2>Encontre um candidato</h2></div>
            <p>{status === 'ready' ? `${filtered.length.toLocaleString('pt-BR')} resultado(s)` : statusMessage}</p>
          </div>
          {metadata?.mode === 'live-cloudflare' && <div className="live-notice">Prévia ao vivo: dados de SP consultados pelo Cloudflare diretamente no DivulgaCandContas/TSE.</div>}

          <div className="filters filters-enhanced">
            <div className="autocomplete" onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}>
              <label className="search-box" htmlFor="candidate-search">
                <span>⌕</span>
                <input
                  id="candidate-search"
                  type="search"
                  placeholder="Nome, número, partido ou ocupação..."
                  value={query}
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsOpen}
                  aria-controls="search-suggestions"
                  aria-activedescendant={activeSuggestion >= 0 ? `search-suggestion-${activeSuggestion}` : undefined}
                  onFocus={() => query.trim().length >= 2 && searchSuggestions.length && setSuggestionsOpen(true)}
                  onChange={(event) => { setQuery(event.target.value); setSuggestionsOpen(true); }}
                  onKeyDown={handleSearchKeyDown}
                />
              </label>
              {suggestionsOpen && searchSuggestions.length > 0 && (
                <div className="autocomplete-menu" id="search-suggestions" role="listbox">
                  <div className="autocomplete-caption">Sugestões</div>
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      id={`search-suggestion-${index}`}
                      key={suggestion.key}
                      className={`autocomplete-option${index === activeSuggestion ? ' active' : ''}`}
                      role="option"
                      aria-selected={index === activeSuggestion}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveSuggestion(index)}
                      onClick={() => chooseSuggestion(suggestion)}
                    >
                      {suggestion.type === 'candidate' ? (
                        <>
                          <CandidateAvatar candidate={suggestion.candidate} />
                          <span className="autocomplete-copy">
                            <strong>{displayName(suggestion.candidate)}</strong>
                            <small>{suggestion.candidate.numero || '—'} · {suggestion.candidate.partido || 'Sem partido'} · {suggestion.candidate.uf || 'BR'}</small>
                          </span>
                          <span className="autocomplete-kind">Candidato</span>
                        </>
                      ) : (
                        <>
                          <span className="party-suggestion-icon">P</span>
                          <span className="autocomplete-copy"><strong>{suggestion.party}</strong><small>{suggestion.count.toLocaleString('pt-BR')} candidato(s) nesta carga</small></span>
                          <span className="autocomplete-kind">Partido</span>
                        </>
                      )}
                    </button>
                  ))}
                  <div className="autocomplete-help">↑ ↓ para navegar · Enter para selecionar · Esc para fechar</div>
                </div>
              )}
            </div>

            <select value={uf} onChange={(event) => setUf(event.target.value)} aria-label="Filtrar por UF">
              <option value="">Todas as UFs</option>
              {ufs.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={occupation} onChange={(event) => setOccupation(event.target.value)} aria-label="Filtrar por ocupação ou profissão">
              <option value="">Todas as ocupações</option>
              {occupations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={party} onChange={(event) => setParty(event.target.value)} aria-label="Filtrar por partido">
              <option value="">Todos os partidos</option>
              {parties.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar resultados">
              <option value="nome">Nome A–Z</option>
              <option value="numero">Número do candidato</option>
              <option value="partido">Partido A–Z</option>
            </select>

            {(query || uf || occupation || party) && <button className="clear-button" onClick={clearFilters} type="button">Limpar</button>}
          </div>

          {status === 'loading' && <div className="state-card"><div className="loader" />{statusMessage}</div>}
          {status === 'waiting' && <div className="state-card waiting"><strong>Site publicado e frontend pronto.</strong><span>{statusMessage}</span></div>}
          {status === 'ready' && candidates.length > 0 && filtered.length === 0 && <div className="state-card">Nenhum candidato encontrado com esses filtros.</div>}
          {filtered.length > 0 && (
            <div className="candidate-list">
              {filtered.slice(0, 120).map((candidate) => (
                <CandidateCard key={candidate.id_tse} candidate={candidate} onOpen={openCandidate} onShare={shareCandidate} />
              ))}
            </div>
          )}
          {filtered.length > 120 && <p className="result-limit">Mostrando os primeiros 120 resultados. Use os filtros para refinar a pesquisa.</p>}
        </section>

        <section className="method-section">
          <div><span className="section-kicker">COMO FUNCIONA</span><h2>Da fonte oficial à consulta pública</h2></div>
          <div className="method-grid">
            <article><span>01</span><h3>Coleta</h3><p>O TSE alimenta a base eleitoral e a Câmara dos Deputados fornece o histórico parlamentar publicado em suas bases oficiais.</p></article>
            <article><span>02</span><h3>Vínculo auditável</h3><p>As correspondências TSE ↔ Câmara só são confirmadas quando a metodologia encontra uma identidade segura, única e verificável nos campos utilizados.</p></article>
            <article><span>03</span><h3>Publicação</h3><p>Dados processados ficam versionados no GitHub e cada alteração é publicada pelo Cloudflare Pages, preservando rastreabilidade das fontes e da metodologia.</p></article>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-project">
          <strong>Eleições 2026</strong>
          <span>Projeto independente de transparência pública.</span>
          <a className="footer-github" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            <GitHubIcon />
            Repositório no GitHub
            <span aria-hidden="true">↗</span>
          </a>
        </div>
        <p>Dados provenientes de fontes públicas oficiais. Ausência de vínculo ou informação significa apenas que o dado não foi confirmado/localizado pela metodologia aplicada.</p>
      </footer>

      <CandidateModal candidate={selected} onClose={closeCandidate} onShare={shareCandidate} />
    </>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);