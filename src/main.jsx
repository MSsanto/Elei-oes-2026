import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const DATA_URL = '/data/deputados_federais.json';
const META_URL = '/data/metadata.json';

function normalize(value = '') {
  return value
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
    return value;
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

function CandidateCard({ candidate, onOpen }) {
  return (
    <button className="candidate-card" onClick={() => onOpen(candidate)} type="button">
      <div className="avatar" aria-hidden="true">{initials(candidate.nome_urna || candidate.nome)}</div>
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
    ['Data de nascimento', candidate.data_nascimento],
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
          <div className="avatar avatar-large" aria-hidden="true">{initials(candidate.nome_urna || candidate.nome)}</div>
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
          <strong>Prestação de contas:</strong> esta será a próxima camada do projeto, com receitas, despesas, fornecedores, categorias e gráficos.
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

function App() {
  const [candidates, setCandidates] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [query, setQuery] = useState('');
  const [uf, setUf] = useState('');
  const [party, setParty] = useState('');
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    Promise.all([
      fetch(DATA_URL).then((response) => {
        if (!response.ok) throw new Error('Falha ao carregar candidaturas');
        return response.json();
      }),
      fetch(META_URL).then((response) => (response.ok ? response.json() : null)),
    ])
      .then(([candidateData, metaData]) => {
        setCandidates(Array.isArray(candidateData) ? candidateData : []);
        setMetadata(metaData);
        setStatus('ready');
      })
      .catch((error) => {
        console.error(error);
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelected(null);
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

      return [
        candidate.nome,
        candidate.nome_urna,
        candidate.numero,
        candidate.partido,
        candidate.ocupacao,
      ].some((value) => normalize(String(value || '')).includes(term));
    });
  }, [candidates, query, uf, party]);

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
            <span>
              <strong>Eleições 2026</strong>
              <small>Transparência de campanhas</small>
            </span>
          </a>
          <a className="github-link" href="https://github.com/MSsanto/Elei-oes-2026" target="_blank" rel="noreferrer">Código aberto ↗</a>
        </nav>

        <div className="hero-content" id="top">
          <div className="eyebrow">DADOS PÚBLICOS · TSE · CÓDIGO ABERTO</div>
          <h1>Veja os dados eleitorais<br /><span>sem precisar decifrar planilhas.</span></h1>
          <p className="hero-copy">
            Consulta independente das candidaturas a Deputado Federal nas Eleições 2026. A próxima etapa integrará prestação de contas, fornecedores e gráficos de gastos.
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
          <div className="stat-card"><strong>{stats.candidates.toLocaleString('pt-BR')}</strong><span>candidaturas</span></div>
          <div className="stat-card"><strong>{stats.ufs}</strong><span>UFs</span></div>
          <div className="stat-card"><strong>{stats.parties}</strong><span>partidos</span></div>
          <div className="stat-card stat-update"><strong>Atualização</strong><span>{formatDate(metadata?.generated_at_utc)}</span></div>
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">CANDIDATURAS 2026</span>
              <h2>Encontre um candidato</h2>
            </div>
            <p>{status === 'ready' ? `${filtered.length.toLocaleString('pt-BR')} resultado(s)` : 'Carregando base pública...'}</p>
          </div>

          <div className="filters">
            <label className="search-box">
              <span>⌕</span>
              <input
                type="search"
                placeholder="Nome, número, partido ou ocupação..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select value={uf} onChange={(event) => setUf(event.target.value)} aria-label="Filtrar por UF">
              <option value="">Todas as UFs</option>
              {ufs.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={party} onChange={(event) => setParty(event.target.value)} aria-label="Filtrar por partido">
              <option value="">Todos os partidos</option>
              {parties.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {(query || uf || party) && (
              <button className="clear-button" onClick={() => { setQuery(''); setUf(''); setParty(''); }} type="button">Limpar</button>
            )}
          </div>

          {status === 'loading' && <div className="state-card"><div className="loader" />Carregando dados do TSE...</div>}
          {status === 'error' && <div className="state-card error">Não foi possível carregar a base de candidaturas neste momento.</div>}
          {status === 'ready' && candidates.length === 0 && (
            <div className="state-card waiting">
              <strong>Site publicado. Base aguardando a primeira coleta automática.</strong>
              <span>Assim que o GitHub Actions gerar os dados processados, eles aparecerão aqui automaticamente.</span>
            </div>
          )}
          {status === 'ready' && candidates.length > 0 && filtered.length === 0 && (
            <div className="state-card">Nenhum candidato encontrado com esses filtros.</div>
          )}

          {filtered.length > 0 && (
            <div className="candidate-list">
              {filtered.slice(0, 120).map((candidate) => (
                <CandidateCard key={candidate.id_tse} candidate={candidate} onOpen={setSelected} />
              ))}
            </div>
          )}
          {filtered.length > 120 && <p className="result-limit">Mostrando os primeiros 120 resultados. Use os filtros para refinar a pesquisa.</p>}
        </section>

        <section className="method-section">
          <div>
            <span className="section-kicker">COMO FUNCIONA</span>
            <h2>Da fonte oficial à consulta pública</h2>
          </div>
          <div className="method-grid">
            <article><span>01</span><h3>Coleta</h3><p>O GitHub Actions baixa periodicamente os arquivos oficiais de dados abertos do TSE.</p></article>
            <article><span>02</span><h3>Normalização</h3><p>O pipeline Python filtra Deputado Federal e mantém o identificador oficial SQ_CANDIDATO.</p></article>
            <article><span>03</span><h3>Publicação</h3><p>Os dados derivados ficam no repositório e o Cloudflare publica a interface automaticamente.</p></article>
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

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
