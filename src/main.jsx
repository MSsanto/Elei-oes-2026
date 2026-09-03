import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './photo.css';
import './autocomplete.css';
import { ChamberActivity, chamberBasePhoto, displayTseValue } from './chamberProfile.jsx';

const DATA_URL = '/data/deputados_federais.json';
const META_URL = '/data/metadata.json';
const IDENTITY_URL = '/data/mappings/identidades.json';
const CHAMBER_HISTORY_URL = '/data/camara/historico_confirmados.json';
const LIVE_SP_URL = '/api/candidates?uf=SP&limit=120';

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

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(number)}%`;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toLocaleString('pt-BR');
}

function uniqueSorted(items, field) {
  return [...new Set(items.map((item) => item[field]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

function candidateHistoricalDdds(candidate) {
  const history = candidate?.historico_eleitoral_2022;
  const values = Array.isArray(history?.ddds_principais) && history.ddds_principais.length
    ? history.ddds_principais
    : history?.ddd_principal ? [history.ddd_principal] : [];
  return values.map(String).filter(Boolean);
}

function historicalDddDisplay(history) {
  const ddds = Array.isArray(history?.ddds_principais) && history.ddds_principais.length
    ? history.ddds_principais
    : history?.ddd_principal ? [history.ddd_principal] : [];
  if (!ddds.length) return '';
  return ddds.map((ddd) => `DDD ${ddd}`).join(' / ');
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
  const name = candidate.nome_urna || candidate.nome || '';
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

function CandidateCard({ candidate, onOpen }) {
  const hasChamberHistory = candidate.identidade_camara?.historico_camara_localizado === true;
  const situation = displayTseValue(candidate.situacao_candidatura);
  const history = candidate.historico_eleitoral_2022;
  const historicalDdd = historicalDddDisplay(history);

  return (
    <button className="candidate-card" onClick={() => onOpen(candidate)} type="button">
      <CandidateAvatar candidate={candidate} />
      <div className="candidate-main">
        <div className="candidate-topline">
          <span className="number">{candidate.numero || '—'}</span>
          <span className="party">{candidate.partido || 'Sem partido informado'}</span>
          <span className="uf">{candidate.uf || 'BR'}</span>
        </div>
        <h3>{candidate.nome_urna || candidate.nome || 'Candidato sem nome'}</h3>
        <p>{candidate.nome && candidate.nome !== candidate.nome_urna ? candidate.nome : 'Deputado Federal'}</p>
        <div className="tags">
          {situation && <span>{situation}</span>}
          {candidate.ocupacao && <span>{candidate.ocupacao}</span>}
          {hasChamberHistory && <span>Histórico na Câmara</span>}
          {historicalDdd && (
            <span title="DDD com maior votação nominal mapeada para Deputado Federal em 2022">
              2022 · {historicalDdd}{history?.percentual_ddd_principal !== undefined ? ` · ${formatPercent(history.percentual_ddd_principal)}` : ''}
            </span>
          )}
        </div>
      </div>
      <span className="open-indicator" aria-hidden="true">→</span>
    </button>
  );
}

function CandidateModal({ candidate, onClose }) {
  if (!candidate) return null;
  const identity = candidate.identidade_camara;
  const confirmed = identity?.correspondencia_status === 'confirmada';
  const history = candidate.historico_eleitoral_2022;
  const historicalDdd = historicalDddDisplay(history);
  const distribution = Array.isArray(history?.distribuicao_ddd) ? history.distribuicao_ddd : [];
  const distributionText = distribution
    .map((item) => `DDD ${item.ddd}: ${formatPercent(item.percentual)} (${formatNumber(item.votos)} votos)`)
    .join(' · ');

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

  const historyRows = history ? [
    ['DDD(s) principal(is) da votação', historicalDdd],
    ['UF da candidatura em 2022', history.uf_2022],
    ['Parcela dos votos mapeados no DDD principal', formatPercent(history.percentual_ddd_principal)],
    ['Votos nominais em 2022', formatNumber(history.votos_nominais_total)],
    ['Cobertura município → DDD', formatPercent(history.cobertura_ddd_percentual)],
    ['Distribuição dos votos mapeados', distributionText],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="candidate-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close-button" onClick={onClose} type="button" aria-label="Fechar">×</button>
        <div className="modal-heading">
          <CandidateAvatar candidate={candidate} large />
          <div>
            <div className="candidate-topline">
              <span className="number">{candidate.numero || '—'}</span>
              <span className="party">{candidate.partido || '—'}</span>
              <span className="uf">{candidate.uf || '—'}</span>
            </div>
            <h2 id="candidate-title">{candidate.nome_urna || candidate.nome}</h2>
            <p>Dados oficiais consolidados por fonte</p>
          </div>
        </div>

        {confirmed ? (
          <ChamberActivity candidate={candidate} identity={identity} />
        ) : (
          <div className="coming-soon">
            <strong>Histórico parlamentar não confirmado.</strong>{' '}
            O projeto só associa uma candidatura à Câmara quando a correspondência entre as fontes oficiais é segura pela metodologia publicada.
          </div>
        )}

        {history && historyRows.length > 0 && (
          <>
            <div className="profile-section-title">Região eleitoral histórica — votação 2022</div>
            <div className="history-note">
              <strong>Referência histórica de votação.</strong>{' '}
              O DDD indica onde se concentrou a maior parcela dos votos nominais mapeados para Deputado Federal em 2022. Não é domicílio eleitoral, residência nem endereço.
            </div>
            <dl className="detail-grid history-detail-grid">
              {historyRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </>
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
  const [historicalDdd, setHistoricalDdd] = useState('');
  const [party, setParty] = useState('');
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
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setSelected(null);
        setSuggestionsOpen(false);
        setActiveSuggestion(-1);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const ufs = useMemo(() => uniqueSorted(candidates, 'uf'), [candidates]);
  const parties = useMemo(() => uniqueSorted(candidates, 'partido'), [candidates]);
  const historicalDdds = useMemo(() => {
    const pool = uf ? candidates.filter((candidate) => candidate.uf === uf) : candidates;
    const values = new Set();
    pool.forEach((candidate) => candidateHistoricalDdds(candidate).forEach((ddd) => values.add(ddd)));
    return [...values].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, 'pt-BR'));
  }, [candidates, uf]);
  const hasHistoricalRegions = useMemo(
    () => candidates.some((candidate) => candidateHistoricalDdds(candidate).length > 0),
    [candidates],
  );

  useEffect(() => {
    if (historicalDdd && !historicalDdds.includes(historicalDdd)) setHistoricalDdd('');
  }, [historicalDdd, historicalDdds]);

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return candidates.filter((candidate) => {
      if (uf && candidate.uf !== uf) return false;
      if (historicalDdd && !candidateHistoricalDdds(candidate).includes(historicalDdd)) return false;
      if (party && candidate.partido !== party) return false;
      if (!term) return true;
      return [candidate.nome, candidate.nome_urna, candidate.numero, candidate.partido, candidate.ocupacao].some((value) => normalize(value).includes(term));
    });
  }, [candidates, query, uf, historicalDdd, party]);

  const searchSuggestions = useMemo(() => {
    const term = normalize(query.trim());
    if (term.length < 2 || status !== 'ready') return [];
    const pool = candidates.filter((candidate) => (
      (!uf || candidate.uf === uf)
      && (!historicalDdd || candidateHistoricalDdds(candidate).includes(historicalDdd))
      && (!party || candidate.partido === party)
    ));
    const candidateMatches = pool
      .filter((candidate) => [candidate.nome_urna, candidate.nome, candidate.numero, candidate.partido].some((value) => normalize(value).includes(term)))
      .sort((a, b) => {
        const aName = normalize(a.nome_urna || a.nome);
        const bName = normalize(b.nome_urna || b.nome);
        return (aName.startsWith(term) ? 0 : 1) - (bName.startsWith(term) ? 0 : 1) || aName.localeCompare(bName, 'pt-BR');
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
          && (!historicalDdd || candidateHistoricalDdds(candidate).includes(historicalDdd))
        )).length,
      }));
    return [...candidateMatches, ...partyMatches].slice(0, 10);
  }, [candidates, parties, query, uf, historicalDdd, party, status]);

  useEffect(() => {
    setActiveSuggestion(-1);
    setSuggestionsOpen(query.trim().length >= 2 && searchSuggestions.length > 0);
  }, [query, searchSuggestions.length]);

  function chooseSuggestion(suggestion) {
    if (!suggestion) return;
    if (suggestion.type === 'candidate') {
      setQuery(suggestion.candidate.nome_urna || suggestion.candidate.nome || suggestion.candidate.numero || '');
      setSelected(suggestion.candidate);
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
    setHistoricalDdd('');
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
          <a className="brand" href="#top" aria-label="Eleições 2026 — início"><span className="brand-mark">E26</span><span><strong>Eleições 2026</strong><small>Transparência de dados públicos</small></span></a>
          <a className="github-link" href="https://github.com/MSsanto/Elei-oes-2026" target="_blank" rel="noreferrer">Código aberto ↗</a>
        </nav>
        <div className="hero-content" id="top">
          <div className="eyebrow">DADOS PÚBLICOS · TSE · CÂMARA · CÓDIGO ABERTO</div>
          <h1>Da candidatura ao mandato,<br /><span>dados oficiais em um só lugar.</span></h1>
          <p className="hero-copy">Consulta independente das candidaturas a Deputado Federal em 2026, integrada progressivamente ao histórico parlamentar e à distribuição regional de votos publicada pelas fontes oficiais.</p>
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
          <div className="section-heading"><div><span className="section-kicker">CANDIDATURAS 2026</span><h2>Encontre um candidato</h2></div><p>{status === 'ready' ? `${filtered.length.toLocaleString('pt-BR')} resultado(s)` : statusMessage}</p></div>
          {metadata?.mode === 'live-cloudflare' && <div className="live-notice">Prévia ao vivo: dados de SP consultados pelo Cloudflare diretamente no DivulgaCandContas/TSE.</div>}

          <div className={`filters${hasHistoricalRegions ? ' filters-with-history' : ''}`}>
            <div className="autocomplete" onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}>
              <label className="search-box" htmlFor="candidate-search"><span>⌕</span><input id="candidate-search" type="search" placeholder="Digite ao menos 2 letras do nome, número ou partido..." value={query} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={suggestionsOpen} aria-controls="search-suggestions" aria-activedescendant={activeSuggestion >= 0 ? `search-suggestion-${activeSuggestion}` : undefined} onFocus={() => query.trim().length >= 2 && searchSuggestions.length && setSuggestionsOpen(true)} onChange={(event) => { setQuery(event.target.value); setSuggestionsOpen(true); }} onKeyDown={handleSearchKeyDown} /></label>
              {suggestionsOpen && searchSuggestions.length > 0 && (
                <div className="autocomplete-menu" id="search-suggestions" role="listbox">
                  <div className="autocomplete-caption">Sugestões</div>
                  {searchSuggestions.map((suggestion, index) => (
                    <button id={`search-suggestion-${index}`} key={suggestion.key} className={`autocomplete-option${index === activeSuggestion ? ' active' : ''}`} role="option" aria-selected={index === activeSuggestion} type="button" onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveSuggestion(index)} onClick={() => chooseSuggestion(suggestion)}>
                      {suggestion.type === 'candidate' ? <><CandidateAvatar candidate={suggestion.candidate} /><span className="autocomplete-copy"><strong>{suggestion.candidate.nome_urna || suggestion.candidate.nome}</strong><small>{suggestion.candidate.numero || '—'} · {suggestion.candidate.partido || 'Sem partido'} · {suggestion.candidate.uf || 'BR'}</small></span><span className="autocomplete-kind">Candidato</span></> : <><span className="party-suggestion-icon">P</span><span className="autocomplete-copy"><strong>{suggestion.party}</strong><small>{suggestion.count.toLocaleString('pt-BR')} candidato(s) nesta carga</small></span><span className="autocomplete-kind">Partido</span></>}
                    </button>
                  ))}
                  <div className="autocomplete-help">↑ ↓ para navegar · Enter para selecionar · Esc para fechar</div>
                </div>
              )}
            </div>
            <select value={uf} onChange={(event) => setUf(event.target.value)} aria-label="Filtrar por UF"><option value="">Todas as UFs</option>{ufs.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            {hasHistoricalRegions && (
              <select value={historicalDdd} onChange={(event) => setHistoricalDdd(event.target.value)} aria-label="Filtrar por DDD histórico principal da votação de 2022">
                <option value="">Todos os DDDs históricos</option>
                {historicalDdds.map((item) => <option key={item} value={item}>DDD {item}</option>)}
              </select>
            )}
            <select value={party} onChange={(event) => setParty(event.target.value)} aria-label="Filtrar por partido"><option value="">Todos os partidos</option>{parties.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            {(query || uf || historicalDdd || party) && <button className="clear-button" onClick={clearFilters} type="button">Limpar</button>}
          </div>
          {hasHistoricalRegions && (
            <p className="history-filter-note">
              <strong>DDD histórico:</strong> região que concentrou a maior parcela dos votos nominais mapeados para Deputado Federal em 2022. Não representa domicílio eleitoral.
            </p>
          )}

          {status === 'loading' && <div className="state-card"><div className="loader" />{statusMessage}</div>}
          {status === 'waiting' && <div className="state-card waiting"><strong>Site publicado e frontend pronto.</strong><span>{statusMessage}</span></div>}
          {status === 'ready' && candidates.length > 0 && filtered.length === 0 && <div className="state-card">Nenhum candidato encontrado com esses filtros.</div>}
          {filtered.length > 0 && <div className="candidate-list">{filtered.slice(0, 120).map((candidate) => <CandidateCard key={candidate.id_tse} candidate={candidate} onOpen={setSelected} />)}</div>}
          {filtered.length > 120 && <p className="result-limit">Mostrando os primeiros 120 resultados. Use os filtros para refinar a pesquisa.</p>}
        </section>

        <section className="method-section">
          <div><span className="section-kicker">COMO FUNCIONA</span><h2>Da fonte oficial à consulta pública</h2></div>
          <div className="method-grid">
            <article><span>01</span><h3>Coleta</h3><p>O TSE alimenta a base eleitoral e a votação histórica por município. A Anatel fornece o Código Nacional (DDD), e a Câmara fornece o histórico parlamentar.</p></article>
            <article><span>02</span><h3>Vínculo auditável</h3><p>As correspondências entre eleições e entre TSE ↔ Câmara só são confirmadas quando a metodologia encontra uma identidade exata, única e verificável nos campos utilizados.</p></article>
            <article><span>03</span><h3>Publicação</h3><p>Dados processados ficam versionados no GitHub e cada alteração é publicada pelo Cloudflare Pages, com distinção explícita entre fatos eleitorais e inferências que o projeto não faz.</p></article>
          </div>
        </section>
      </main>

      <footer><div><strong>Eleições 2026</strong><span>Projeto independente de transparência pública.</span></div><p>Dados provenientes de fontes públicas oficiais. Ausência de vínculo ou informação significa apenas que o dado não foi confirmado/localizado pela metodologia aplicada.</p></footer>
      <CandidateModal candidate={selected} onClose={() => setSelected(null)} />
    </>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
