import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './photo.css';
import './autocomplete.css';

const DATA_URL = '/data/deputados_federais.json';
const META_URL = '/data/metadata.json';
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

function uniqueSorted(items, field) {
  return [...new Set(items.map((item) => item[field]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
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
  const [failed, setFailed] = useState(false);
  const name = candidate.nome_urna || candidate.nome || '';
  const className = `avatar${large ? ' avatar-large' : ''}`;

  if (candidate.foto_url && !failed) {
    return (
      <div className={className} aria-hidden="true">
        <img
          src={candidate.foto_url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return <div className={className} aria-hidden="true">{initials(name)}</div>;
}

function CandidateCard({ candidate, onOpen }) {
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
          {candidate.situacao_candidatura && <span>{candidate.situacao_candidatura}</span>}
          {candidate.ocupacao && <span>{candidate.ocupacao}</span>}
        </div>
      </div>
      <span className="open-indicator" aria-hidden="true">→</span>
    </button>
  );
}

function CandidateModal({ candidate, onClose }) {
  if (!candidate) return null;

  const rows = [
    ['Nome completo', candidate.nome],
    ['Nome de urna', candidate.nome_urna],
    ['Número', candidate.numero],
    ['Partido', candidate.partido],
    ['UF', candidate.uf],
    ['Situação da candidatura', candidate.situacao_candidatura],
    ['Situação na urna', candidate.situacao_urna],
    ['Ocupação', candidate.ocupacao],
    ['Grau de instrução', candidate.grau_instrucao],
    ['Gênero', candidate.genero],
    ['Cor/raça declarada', candidate.cor_raca],
    ['Data de nascimento', formatBirthDate(candidate.data_nascimento)],
    ['Identificador TSE', candidate.id_tse],
  ].filter(([, value]) => value);

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
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
            <p>Dados cadastrais oficiais do TSE</p>
          </div>
        </div>

        <div className="coming-soon">
          <strong>Próxima camada:</strong> prestação de contas com receitas, despesas, fornecedores, categorias e gráficos, sempre preservando a origem oficial dos dados.
        </div>

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

async function loadStaticData() {
  const [candidateResponse, metadataResponse] = await Promise.all([
    fetch(DATA_URL, { cache: 'no-cache' }),
    fetch(META_URL, { cache: 'no-cache' }),
  ]);

  if (!candidateResponse.ok) throw new Error('Falha ao carregar a base estática.');
  const candidates = await candidateResponse.json();
  const metadata = metadataResponse.ok ? await metadataResponse.json() : null;
  return { candidates: Array.isArray(candidates) ? candidates : [], metadata };
}

async function loadLivePreview() {
  const response = await fetch(LIVE_SP_URL, { cache: 'no-cache' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
  return {
    candidates: Array.isArray(payload.candidates) ? payload.candidates : [],
    metadata: {
      source: payload.source,
      generated_at_utc: payload.generated_at_utc,
      records: payload.records,
      uf: payload.uf,
      election_id: payload.election_id,
      mode: 'live-cloudflare',
    },
  };
}

function App() {
  const [candidates, setCandidates] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [query, setQuery] = useState('');
  const [uf, setUf] = useState('');
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
        if (!liveData.candidates.length) setStatusMessage('O TSE respondeu, mas não retornou candidatos nessa consulta.');
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

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return candidates.filter((candidate) => {
      if (uf && candidate.uf !== uf) return false;
      if (party && candidate.partido !== party) return false;
      if (!term) return true;

      return [candidate.nome, candidate.nome_urna, candidate.numero, candidate.partido, candidate.ocupacao]
        .some((value) => normalize(value).includes(term));
    });
  }, [candidates, query, uf, party]);

  const searchSuggestions = useMemo(() => {
    const rawTerm = query.trim();
    const term = normalize(rawTerm);
    if (term.length < 2 || status !== 'ready') return [];

    const candidatePool = candidates.filter((candidate) => {
      if (uf && candidate.uf !== uf) return false;
      if (party && candidate.partido !== party) return false;
      return true;
    });

    const candidateMatches = candidatePool
      .filter((candidate) => [candidate.nome_urna, candidate.nome, candidate.numero, candidate.partido]
        .some((value) => normalize(value).includes(term)))
      .sort((a, b) => {
        const aName = normalize(a.nome_urna || a.nome);
        const bName = normalize(b.nome_urna || b.nome);
        const aStarts = aName.startsWith(term) ? 0 : 1;
        const bStarts = bName.startsWith(term) ? 0 : 1;
        return aStarts - bStarts || aName.localeCompare(bName, 'pt-BR');
      })
      .slice(0, 7)
      .map((candidate) => ({
        type: 'candidate',
        key: `candidate-${candidate.id_tse}`,
        candidate,
      }));

    const partyMatches = parties
      .filter((item) => normalize(item).includes(term))
      .slice(0, 3)
      .map((item) => ({
        type: 'party',
        key: `party-${item}`,
        party: item,
        count: candidates.filter((candidate) => candidate.partido === item && (!uf || candidate.uf === uf)).length,
      }));

    return [...candidateMatches, ...partyMatches].slice(0, 10);
  }, [candidates, parties, query, uf, party, status]);

  useEffect(() => {
    setActiveSuggestion(-1);
    setSuggestionsOpen(query.trim().length >= 2 && searchSuggestions.length > 0);
  }, [query, searchSuggestions.length]);

  function chooseSuggestion(suggestion) {
    if (!suggestion) return;

    if (suggestion.type === 'candidate') {
      const candidate = suggestion.candidate;
      setQuery(candidate.nome_urna || candidate.nome || candidate.numero || '');
      setSelected(candidate);
    } else if (suggestion.type === 'party') {
      setParty(suggestion.party);
      setQuery('');
    }

    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  function handleSearchKeyDown(event) {
    if (!suggestionsOpen || searchSuggestions.length === 0) return;

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
    setParty('');
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  const stats = useMemo(() => ({
    candidates: candidates.length,
    ufs: uniqueSorted(candidates, 'uf').length,
    parties: uniqueSorted(candidates, 'partido').length,
  }), [candidates]);

  return (
    <>
      <header className="hero">
        <nav className="topbar" aria-label="Navegação principal">
          <a className="brand" href="#top" aria-label="Eleições 2026 — início">
            <span className="brand-mark">E26</span>
            <span><strong>Eleições 2026</strong><small>Transparência de campanhas</small></span>
          </a>
          <a className="github-link" href="https://github.com/MSsanto/Elei-oes-2026" target="_blank" rel="noreferrer">Código aberto ↗</a>
        </nav>

        <div className="hero-content" id="top">
          <div className="eyebrow">DADOS PÚBLICOS · TSE · CÓDIGO ABERTO</div>
          <h1>Veja os dados eleitorais<br /><span>sem precisar decifrar planilhas.</span></h1>
          <p className="hero-copy">
            Consulta independente das candidaturas a Deputado Federal nas Eleições 2026. O projeto evoluirá para receitas, despesas, fornecedores e gráficos de gastos.
          </p>
          <div className="trust-row">
            <span>Fonte oficial: Tribunal Superior Eleitoral</span>
            <span>Sem vínculo partidário</span>
            <span>Metodologia auditável</span>
          </div>
        </div>
      </header>

      <main>
        <section className="stats-wrap" aria-label="Resumo dos dados">
          <div className="stat-card"><strong>{stats.candidates.toLocaleString('pt-BR')}</strong><span>candidaturas carregadas</span></div>
          <div className="stat-card"><strong>{stats.ufs}</strong><span>UFs nesta carga</span></div>
          <div className="stat-card"><strong>{stats.parties}</strong><span>partidos</span></div>
          <div className="stat-card stat-update"><strong>Atualização</strong><span>{formatDate(metadata?.generated_at_utc)}</span></div>
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div><span className="section-kicker">CANDIDATURAS 2026</span><h2>Encontre um candidato</h2></div>
            <p>{status === 'ready' ? `${filtered.length.toLocaleString('pt-BR')} resultado(s)` : statusMessage}</p>
          </div>

          {metadata?.mode === 'live-cloudflare' && (
            <div className="live-notice">Prévia ao vivo: dados de SP consultados pelo Cloudflare diretamente no DivulgaCandContas/TSE.</div>
          )}

          <div className="filters">
            <div
              className="autocomplete"
              onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
            >
              <label className="search-box" htmlFor="candidate-search">
                <span>⌕</span>
                <input
                  id="candidate-search"
                  type="search"
                  placeholder="Digite ao menos 2 letras do nome, número ou partido..."
                  value={query}
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsOpen}
                  aria-controls="search-suggestions"
                  aria-activedescendant={activeSuggestion >= 0 ? `search-suggestion-${activeSuggestion}` : undefined}
                  onFocus={() => {
                    if (query.trim().length >= 2 && searchSuggestions.length > 0) setSuggestionsOpen(true);
                  }}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSuggestionsOpen(true);
                  }}
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
                            <strong>{suggestion.candidate.nome_urna || suggestion.candidate.nome}</strong>
                            <small>
                              {suggestion.candidate.numero || '—'} · {suggestion.candidate.partido || 'Sem partido'} · {suggestion.candidate.uf || 'BR'}
                            </small>
                          </span>
                          <span className="autocomplete-kind">Candidato</span>
                        </>
                      ) : (
                        <>
                          <span className="party-suggestion-icon">P</span>
                          <span className="autocomplete-copy">
                            <strong>{suggestion.party}</strong>
                            <small>{suggestion.count.toLocaleString('pt-BR')} candidato(s) nesta carga</small>
                          </span>
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
            <select value={party} onChange={(event) => setParty(event.target.value)} aria-label="Filtrar por partido">
              <option value="">Todos os partidos</option>
              {parties.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {(query || uf || party) && <button className="clear-button" onClick={clearFilters} type="button">Limpar</button>}
          </div>

          {status === 'loading' && <div className="state-card"><div className="loader" />{statusMessage}</div>}
          {status === 'waiting' && (
            <div className="state-card waiting">
              <strong>Site publicado e frontend pronto.</strong>
              <span>{statusMessage}</span>
            </div>
          )}
          {status === 'ready' && candidates.length > 0 && filtered.length === 0 && <div className="state-card">Nenhum candidato encontrado com esses filtros.</div>}

          {filtered.length > 0 && (
            <div className="candidate-list">
              {filtered.slice(0, 120).map((candidate) => <CandidateCard key={candidate.id_tse} candidate={candidate} onOpen={setSelected} />)}
            </div>
          )}
          {filtered.length > 120 && <p className="result-limit">Mostrando os primeiros 120 resultados. Use os filtros para refinar a pesquisa.</p>}
        </section>

        <section className="method-section">
          <div><span className="section-kicker">COMO FUNCIONA</span><h2>Da fonte oficial à consulta pública</h2></div>
          <div className="method-grid">
            <article><span>01</span><h3>Coleta</h3><p>O projeto tenta obter os dados oficiais do TSE por pipeline e, durante o desenvolvimento, por uma função serverless no Cloudflare.</p></article>
            <article><span>02</span><h3>Normalização</h3><p>Os campos são convertidos para um formato estável, preservando o identificador oficial do candidato e a fonte original.</p></article>
            <article><span>03</span><h3>Publicação</h3><p>O código fica no GitHub e o Cloudflare Pages publica automaticamente cada versão aprovada da interface.</p></article>
          </div>
        </section>
      </main>

      <footer>
        <div><strong>Eleições 2026</strong><span>Projeto independente de transparência pública.</span></div>
        <p>Dados obtidos do Tribunal Superior Eleitoral. As informações podem sofrer retificações na fonte oficial.</p>
      </footer>

      <CandidateModal candidate={selected} onClose={() => setSelected(null)} />
    </>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);