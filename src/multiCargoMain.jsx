import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './photo.css';
import './autocomplete.css';
import './uxEnhancements.css';
import './multiCargo.css';
import { ChamberActivity, chamberBasePhoto, displayTseValue } from './chamberProfile.jsx';

const REPOSITORY_URL = 'https://github.com/MSsanto/Elei-oes-2026';
const IDENTITY_URL = '/data/mappings/identidades.json';
const CHAMBER_HISTORY_URL = '/data/camara/historico_confirmados.json';
const RESULT_BATCH_SIZE = 60;

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const CARGO_CONFIG = {
  presidente: {
    slug: 'presidente',
    label: 'Presidente',
    plural: 'Presidente',
    kicker: 'PRESIDÊNCIA DA REPÚBLICA',
    scopeLabel: 'Brasil',
    requiresUf: false,
    supportsUf: false,
    hasChamber: false,
    dataUrl: () => '/data/candidatos/presidente/brasil.json',
    metaUrl: '/data/candidatos/presidente/manifest.json',
  },
  governador: {
    slug: 'governador',
    label: 'Governador',
    plural: 'Governador',
    kicker: 'GOVERNOS ESTADUAIS',
    scopeLabel: 'UF selecionada',
    requiresUf: true,
    supportsUf: true,
    hasChamber: false,
    dataUrl: (uf) => `/data/candidatos/governador/${uf}.json`,
    metaUrl: '/data/candidatos/governador/manifest.json',
  },
  'deputado-federal': {
    slug: 'deputado-federal',
    label: 'Deputado Federal',
    plural: 'Deputado Federal',
    kicker: 'CÂMARA DOS DEPUTADOS',
    scopeLabel: 'Brasil por UF',
    requiresUf: false,
    supportsUf: true,
    hasChamber: true,
    dataUrl: () => '/data/deputados_federais.json',
    metaUrl: '/data/metadata.json',
  },
};

function initialParam(name, fallback = '') {
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

function initialCargo() {
  const requested = initialParam('cargo', 'deputado-federal');
  return CARGO_CONFIG[requested] ? requested : 'deputado-federal';
}

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
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
    return String(a.partido || '').localeCompare(String(b.partido || ''), 'pt-BR', { sensitivity: 'base' }) || byName();
  }

  return byName();
}

function setUrlState(values) {
  const url = new URL(window.location.href);
  Object.entries(values).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  });
  window.history.replaceState({}, '', url);
}

function candidateProfileUrl(candidate) {
  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.set('candidato', String(candidate.id_tse));
  return url.toString();
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
  const sources = [candidate.foto_url, chamberBasePhoto(candidate)]
    .filter((value, index, array) => value && array.indexOf(value) === index);
  const [sourceIndex, setSourceIndex] = useState(0);
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
  return <div className={className} aria-hidden="true">{initials(displayName(candidate))}</div>;
}

function CandidateCard({ candidate, cargoConfig, onOpen, onShare }) {
  const hasChamberHistory = candidate.identidade_camara?.historico_camara_localizado === true;
  const situation = displayTseValue(candidate.situacao_candidatura);
  const candidateCargo = candidate.cargo || cargoConfig.label;

  return (
    <article className={`candidate-card${hasChamberHistory ? ' has-chamber-history' : ''}`}>
      <button className="candidate-card-open" onClick={() => onOpen(candidate)} type="button" aria-label={`Abrir perfil de ${displayName(candidate)}`}>
        <CandidateAvatar candidate={candidate} />
        <div className="candidate-main">
          <div className="candidate-topline">
            <span className="number">{candidate.numero || '—'}</span>
            <span className="party">{candidate.partido || 'Sem partido informado'}</span>
            <span className="uf">{candidate.uf || (cargoConfig.slug === 'presidente' ? 'BR' : '—')}</span>
          </div>
          <h3>{displayName(candidate)}</h3>
          <p>{candidate.nome && candidate.nome !== candidate.nome_urna ? candidate.nome : candidateCargo}</p>
          <div className="tags">
            {situation && <span>{situation}</span>}
            {candidate.ocupacao && <span>{candidate.ocupacao}</span>}
            {hasChamberHistory && (
              <span className="history-badge" title="Histórico parlamentar localizado e vinculado com correspondência confirmada nas fontes oficiais">
                Histórico na Câmara
              </span>
            )}
          </div>
        </div>
      </button>
      <button className="candidate-share" onClick={() => onShare(candidate)} type="button" aria-label={`Compartilhar perfil de ${displayName(candidate)}`} title="Compartilhar perfil">
        <ShareIcon />
      </button>
    </article>
  );
}

function CandidateModal({ candidate, cargoConfig, onClose, onShare }) {
  if (!candidate) return null;
  const identity = candidate.identidade_camara;
  const confirmed = cargoConfig.hasChamber && identity?.correspondencia_status === 'confirmada';

  const rows = [
    ['Cargo', candidate.cargo || cargoConfig.label],
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
            <p>{candidate.cargo || cargoConfig.label} · dados oficiais consolidados por fonte</p>
          </div>
          <button className="modal-share-button" onClick={() => onShare(candidate)} type="button">
            <ShareIcon /> Compartilhar
          </button>
        </div>

        {cargoConfig.hasChamber && (
          confirmed ? (
            <ChamberActivity candidate={candidate} identity={identity} />
          ) : (
            <div className="coming-soon">
              <strong>Histórico parlamentar não confirmado.</strong>{' '}
              O projeto só associa uma candidatura à Câmara quando a correspondência entre as fontes oficiais é segura pela metodologia publicada.
            </div>
          )
        )}

        <div className="profile-section-title">Candidatura 2026</div>
        <dl className="detail-grid">
          {rows.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
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
      cargo: candidate.cargo || 'Deputado Federal',
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

async function requiredJson(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadCargo(cargo, uf) {
  const config = CARGO_CONFIG[cargo];
  if (config.requiresUf && !uf) {
    const metadata = await optionalJson(config.metaUrl);
    return { candidates: [], metadata, needsUf: true };
  }

  if (config.hasChamber) {
    const [rawCandidates, metadata, identityPayload, historyPayload] = await Promise.all([
      requiredJson(config.dataUrl(uf)),
      optionalJson(config.metaUrl),
      optionalJson(IDENTITY_URL),
      optionalJson(CHAMBER_HISTORY_URL),
    ]);
    return {
      candidates: attachOfficialSources(Array.isArray(rawCandidates) ? rawCandidates : [], identityPayload, historyPayload),
      metadata,
      needsUf: false,
    };
  }

  const [rawCandidates, metadata] = await Promise.all([
    requiredJson(config.dataUrl(uf)),
    optionalJson(config.metaUrl),
  ]);
  return {
    candidates: (Array.isArray(rawCandidates) ? rawCandidates : []).map((candidate) => ({
      ...candidate,
      cargo: candidate.cargo || config.label,
    })),
    metadata,
    needsUf: false,
  };
}

function CargoTabs({ cargo, onChange }) {
  const tabs = ['presidente', 'governador', 'deputado-federal'];
  return (
    <div className="cargo-tabs" role="tablist" aria-label="Cargo eleitoral">
      {tabs.map((slug) => (
        <button
          key={slug}
          type="button"
          role="tab"
          aria-selected={cargo === slug}
          className={cargo === slug ? 'active' : ''}
          onClick={() => onChange(slug)}
        >
          {CARGO_CONFIG[slug].label}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [cargo, setCargo] = useState(initialCargo);
  const [candidates, setCandidates] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [query, setQuery] = useState(() => initialParam('q'));
  const [uf, setUf] = useState(() => initialParam('uf'));
  const [occupation, setOccupation] = useState(() => initialParam('ocupacao'));
  const [party, setParty] = useState(() => initialParam('partido'));
  const [sortBy, setSortBy] = useState(() => initialParam('ordenacao', 'nome'));
  const [visibleCount, setVisibleCount] = useState(RESULT_BATCH_SIZE);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('loading');
  const [statusMessage, setStatusMessage] = useState('Carregando base pública...');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const loadMoreRef = useRef(null);
  const config = CARGO_CONFIG[cargo];

  useEffect(() => {
    let active = true;
    setSelected(null);
    setCandidates([]);
    setMetadata(null);
    setVisibleCount(RESULT_BATCH_SIZE);

    if (config.requiresUf && !uf) {
      setStatus('needs-uf');
      setStatusMessage('Escolha uma UF para carregar as candidaturas a Governador.');
    } else {
      setStatus('loading');
      setStatusMessage(`Carregando candidaturas a ${config.label}...`);
    }

    loadCargo(cargo, uf)
      .then(({ candidates: loaded, metadata: meta, needsUf }) => {
        if (!active) return;
        setCandidates(loaded);
        setMetadata(meta);
        if (needsUf) {
          setStatus('needs-uf');
          return;
        }
        setStatus('ready');
      })
      .catch((error) => {
        console.error(error);
        if (!active) return;
        setStatus('waiting');
        setStatusMessage(
          cargo === 'deputado-federal'
            ? `Não foi possível carregar a base publicada: ${error.message}`
            : `A base de ${config.label} ainda não foi publicada pela coleta multi-cargo ou está indisponível: ${error.message}`,
        );
      });

    return () => { active = false; };
  }, [cargo, uf, config.label, config.requiresUf]);

  useEffect(() => {
    setUrlState({
      cargo,
      uf: config.supportsUf ? uf : '',
      partido: party,
      ocupacao: occupation,
      q: query.trim(),
      ordenacao: sortBy === 'nome' ? '' : sortBy,
    });
  }, [cargo, uf, party, occupation, query, sortBy, config.supportsUf]);

  useEffect(() => {
    if (status !== 'ready' || candidates.length === 0) return;
    const candidateId = initialParam('candidato');
    if (!candidateId) return;
    const match = candidates.find((candidate) => String(candidate.id_tse) === candidateId);
    if (match) setSelected(match);
  }, [candidates, status]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setSelected(null);
        setUrlState({ candidato: '' });
        setSuggestionsOpen(false);
        setActiveSuggestion(-1);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const ufs = useMemo(
    () => cargo === 'deputado-federal' ? uniqueSorted(candidates, 'uf') : UFS,
    [cargo, candidates],
  );
  const occupations = useMemo(() => uniqueSorted(candidates, 'ocupacao'), [candidates]);
  const parties = useMemo(() => uniqueSorted(candidates, 'partido'), [candidates]);

  useEffect(() => {
    if (party && parties.length && !parties.includes(party)) setParty('');
    if (occupation && occupations.length && !occupations.includes(occupation)) setOccupation('');
  }, [parties, occupations, party, occupation]);

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    const result = candidates.filter((candidate) => {
      if (cargo === 'deputado-federal' && uf && candidate.uf !== uf) return false;
      if (occupation && candidate.ocupacao !== occupation) return false;
      if (party && candidate.partido !== party) return false;
      if (!term) return true;
      return [candidate.nome, candidate.nome_urna, candidate.numero, candidate.partido, candidate.ocupacao]
        .some((value) => normalize(value).includes(term));
    });
    return result.sort((a, b) => compareCandidates(a, b, sortBy));
  }, [candidates, cargo, query, uf, occupation, party, sortBy]);

  const visibleCandidates = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMoreResults = visibleCount < filtered.length;
  const hasActiveFilters = Boolean(query.trim() || occupation || party || (config.supportsUf && uf));

  useEffect(() => {
    setVisibleCount(RESULT_BATCH_SIZE);
  }, [cargo, query, uf, occupation, party, sortBy]);

  useEffect(() => {
    if (!hasMoreResults || typeof IntersectionObserver === 'undefined') return undefined;
    const target = loadMoreRef.current;
    if (!target) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((current) => Math.min(current + RESULT_BATCH_SIZE, filtered.length));
        }
      },
      { rootMargin: '500px 0px', threshold: 0.01 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreResults, filtered.length]);

  const searchSuggestions = useMemo(() => {
    const term = normalize(query.trim());
    if (term.length < 2 || status !== 'ready') return [];
    const candidateMatches = filtered
      .filter((candidate) => [candidate.nome_urna, candidate.nome, candidate.numero, candidate.partido]
        .some((value) => normalize(value).includes(term)))
      .slice(0, 7)
      .map((candidate) => ({ type: 'candidate', key: `candidate-${candidate.id_tse}`, candidate }));
    const partyMatches = parties
      .filter((item) => normalize(item).includes(term))
      .slice(0, 3)
      .map((item) => ({ type: 'party', key: `party-${item}`, party: item }));
    return [...candidateMatches, ...partyMatches].slice(0, 10);
  }, [filtered, parties, query, status]);

  useEffect(() => {
    setActiveSuggestion(-1);
    setSuggestionsOpen(query.trim().length >= 2 && searchSuggestions.length > 0);
  }, [query, searchSuggestions.length]);

  function changeCargo(nextCargo) {
    if (nextCargo === cargo) return;
    setCargo(nextCargo);
    setQuery('');
    setParty('');
    setOccupation('');
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    setSelected(null);
    setUrlState({ candidato: '' });
    if (!CARGO_CONFIG[nextCargo].supportsUf) setUf('');
  }

  function openCandidate(candidate) {
    setSelected(candidate);
    setUrlState({ candidato: candidate.id_tse });
  }

  function closeCandidate() {
    setSelected(null);
    setUrlState({ candidato: '' });
  }

  async function shareCandidate(candidate) {
    const url = candidateProfileUrl(candidate);
    const title = `${displayName(candidate)} — Eleições 2026`;
    const details = [candidate.cargo || config.label, candidate.numero, candidate.partido, candidate.uf]
      .filter(Boolean).join(' · ');
    const text = `${displayName(candidate)}${details ? ` — ${details}` : ''}. Perfil com dados oficiais no Eleições 2026.`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener,noreferrer');
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
    setOccupation('');
    setParty('');
    if (!config.requiresUf) setUf('');
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  const stats = useMemo(() => ({
    candidates: candidates.length,
    parties: uniqueSorted(candidates, 'partido').length,
    chamberHistory: candidates.filter((item) => item.identidade_camara?.historico_camara_localizado).length,
    ufs: uniqueSorted(candidates, 'uf').length,
  }), [candidates]);

  const scopeValue = cargo === 'presidente'
    ? 'Brasil'
    : cargo === 'governador'
      ? (uf || 'Escolha uma UF')
      : `${stats.ufs} UFs`;

  return (
    <>
      <header className="hero multi-cargo-hero">
        <nav className="topbar" aria-label="Navegação principal">
          <a className="brand" href="#top" aria-label="Eleições 2026 — início">
            <span className="brand-mark">E26</span>
            <span><strong>Eleições 2026</strong><small>Transparência de dados públicos</small></span>
          </a>
          <a className="github-link" href={REPOSITORY_URL} target="_blank" rel="noreferrer" aria-label="Abrir repositório do projeto no GitHub">
            <GitHubIcon /><span>GitHub</span><span aria-hidden="true">↗</span>
          </a>
        </nav>
        <div className="hero-content" id="top">
          <CargoTabs cargo={cargo} onChange={changeCargo} />
          <div className="eyebrow">{config.kicker} · TSE · DADOS PÚBLICOS · CÓDIGO ABERTO</div>
          <h1>Da candidatura ao mandato,<br /><span>dados oficiais em um só lugar.</span></h1>
          <p className="hero-copy">
            Consulta independente das candidaturas a {config.label} nas Eleições 2026, com filtros objetivos, fontes identificadas e metodologia auditável.
          </p>
          <div className="trust-row"><span>Fontes oficiais identificadas</span><span>Sem vínculo partidário</span><span>Sem ranking de candidaturas</span></div>
        </div>
      </header>

      <main>
        <section className="stats-wrap" aria-label="Resumo dos dados">
          <div className="stat-card"><strong>{stats.candidates.toLocaleString('pt-BR')}</strong><span>candidaturas carregadas</span></div>
          <div className="stat-card"><strong>{scopeValue}</strong><span>circunscrição da consulta</span></div>
          <div className="stat-card">
            <strong>{config.hasChamber ? stats.chamberHistory.toLocaleString('pt-BR') : stats.parties.toLocaleString('pt-BR')}</strong>
            <span>{config.hasChamber ? 'históricos na Câmara confirmados' : 'partidos nesta carga'}</span>
          </div>
          <div className="stat-card stat-update"><strong>Atualização</strong><span>{formatDate(metadata?.generated_at_utc)}</span></div>
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div><span className="section-kicker">CANDIDATURAS 2026</span><h2>Encontre um candidato</h2></div>
            <p>{status === 'ready' ? `${filtered.length.toLocaleString('pt-BR')} resultado(s)` : statusMessage}</p>
          </div>

          <div className={`filters filters-enhanced multi-cargo-filters ${!config.supportsUf ? 'without-uf' : ''}`}>
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
                          <span className="autocomplete-copy"><strong>{suggestion.party}</strong><small>Filtrar por partido</small></span>
                          <span className="autocomplete-kind">Partido</span>
                        </>
                      )}
                    </button>
                  ))}
                  <div className="autocomplete-help">↑ ↓ para navegar · Enter para selecionar · Esc para fechar</div>
                </div>
              )}
            </div>

            {config.supportsUf && (
              <select value={uf} onChange={(event) => setUf(event.target.value)} aria-label={config.requiresUf ? 'Escolha obrigatória da UF' : 'Filtrar por UF'}>
                <option value="">{config.requiresUf ? 'Escolha uma UF' : 'Todas as UFs'}</option>
                {ufs.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            )}

            <select value={party} onChange={(event) => setParty(event.target.value)} aria-label="Filtrar por partido" disabled={status !== 'ready'}>
              <option value="">Todos os partidos</option>
              {parties.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={occupation} onChange={(event) => setOccupation(event.target.value)} aria-label="Filtrar por ocupação ou profissão" disabled={status !== 'ready'}>
              <option value="">Todas as ocupações</option>
              {occupations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar resultados" disabled={status !== 'ready'}>
              <option value="nome">Nome A–Z</option>
              <option value="numero">Número do candidato</option>
              <option value="partido">Partido A–Z</option>
            </select>

            {hasActiveFilters && <button className="clear-button" onClick={clearFilters} type="button">Limpar</button>}
          </div>

          {status === 'loading' && <div className="state-card"><div className="loader" />{statusMessage}</div>}
          {status === 'needs-uf' && (
            <div className="state-card governor-empty-state">
              <div className="empty-state-icon" aria-hidden="true">⌖</div>
              <strong>Escolha uma UF para consultar Governador</strong>
              <span>A carga é feita somente para o estado selecionado. Nenhuma UF é escolhida automaticamente pelo sistema.</span>
            </div>
          )}
          {status === 'waiting' && (
            <div className="state-card waiting"><strong>Interface multi-cargo publicada.</strong><span>{statusMessage}</span></div>
          )}
          {status === 'ready' && candidates.length > 0 && filtered.length === 0 && (
            <div className="state-card search-empty-state">
              <div className="empty-state-icon" aria-hidden="true">⌕</div>
              <strong>Nenhuma candidatura encontrada</strong>
              <span>Verifique a grafia do termo pesquisado ou remova algum dos filtros aplicados.</span>
              {hasActiveFilters && <button className="empty-clear-button" onClick={clearFilters} type="button">Limpar filtros</button>}
            </div>
          )}
          {status === 'ready' && candidates.length === 0 && (
            <div className="state-card search-empty-state">
              <strong>Nenhuma candidatura publicada nesta carga</strong>
              <span>Isso indica apenas que a base processada atual não contém registros para esta consulta.</span>
            </div>
          )}

          {visibleCandidates.length > 0 && (
            <div className="candidate-list">
              {visibleCandidates.map((candidate) => (
                <CandidateCard key={candidate.id_tse} candidate={candidate} cargoConfig={config} onOpen={openCandidate} onShare={shareCandidate} />
              ))}
            </div>
          )}
          {hasMoreResults && (
            <button
              ref={loadMoreRef}
              className="clear-button result-limit"
              onClick={() => setVisibleCount((current) => Math.min(current + RESULT_BATCH_SIZE, filtered.length))}
              type="button"
              aria-label={`Carregar mais resultados. ${visibleCandidates.length} de ${filtered.length} exibidos`}
            >
              Mostrando {visibleCandidates.length.toLocaleString('pt-BR')} de {filtered.length.toLocaleString('pt-BR')} · carregar mais
            </button>
          )}
        </section>

        <section className="method-section">
          <div><span className="section-kicker">COMO FUNCIONA</span><h2>Da fonte oficial à consulta pública</h2></div>
          <div className="method-grid">
            <article><span>01</span><h3>Coleta</h3><p>O TSE alimenta as candidaturas de 2026. Os arquivos são processados por cargo e, quando aplicável, por UF para reduzir o volume baixado pelo navegador.</p></article>
            <article><span>02</span><h3>Consulta objetiva</h3><p>Filtros, ordenação e abas reproduzem escolhas explícitas do usuário. O projeto não cria ranking, recomendação ou prioridade política.</p></article>
            <article><span>03</span><h3>Publicação</h3><p>Dados processados ficam versionados no GitHub e são publicados pelo Cloudflare Pages, preservando fonte, data da carga e metodologia.</p></article>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-project">
          <strong>Eleições 2026</strong><span>Projeto independente de transparência pública.</span>
          <a className="footer-github" href={REPOSITORY_URL} target="_blank" rel="noreferrer"><GitHubIcon />Repositório no GitHub<span aria-hidden="true">↗</span></a>
        </div>
        <p>Dados provenientes de fontes públicas oficiais. Ausência de vínculo ou informação significa apenas que o dado não foi confirmado/localizado pela metodologia aplicada.</p>
      </footer>

      <CandidateModal candidate={selected} cargoConfig={config} onClose={closeCandidate} onShare={shareCandidate} />
    </>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
