import React, { useEffect, useMemo, useState } from 'react';
import PlatformHeader from './PlatformHeader.jsx';
import { ELECTORATE_BY_UF, formatInteger } from './election2026Facts.js';
import { fetchElectionResults, OFFICIAL_RESULTS_URL } from './electionResults.jsx';
import './electedCandidates.css';

const CARGOS = [
  { slug: 'presidente', label: 'Presidência' },
  { slug: 'governador', label: 'Governo estadual' },
  { slug: 'senador', label: 'Senado' },
  { slug: 'deputado-federal', label: 'Deputado federal' },
  { slug: 'deputado-estadual', label: 'Deputado estadual/distrital' },
];
const PAGE_SIZE = 60;

function dataUrl(cargo, uf) {
  if (cargo === 'presidente') return '/data/candidatos/presidente/brasil.json';
  if (cargo === 'deputado-federal') return '/data/deputados_federais.json';
  if (!uf) return null;
  if (cargo === 'deputado-estadual') return `/data/candidatos/deputado-estadual/${uf}/search-index.json`;
  return `/data/candidatos/${cargo}/${uf}.json`;
}

function statusMatches(candidate, cargo, snapshot) {
  const id = String(candidate?.id_tse || '');
  const record = snapshot?.candidaturas?.[id];
  return Boolean(record && record.situacao === 'eleito' && record.cargo === cargo &&
    record.uf === (cargo === 'presidente' ? 'BR' : candidate.uf));
}

function profileLink(candidate, cargo) {
  const params = new URLSearchParams({ cargo });
  if (cargo !== 'presidente') params.set('uf', candidate.uf);
  return `/candidato/${encodeURIComponent(candidate.id_tse)}?${params}`;
}

export default function ElectedCandidatesPage() {
  const [cargo, setCargo] = useState('presidente');
  const [uf, setUf] = useState('');
  const [query, setQuery] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotState, setSnapshotState] = useState('loading');
  const [records, setRecords] = useState([]);
  const [recordsState, setRecordsState] = useState('idle');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    document.title = 'Eleitas e eleitos em 2026 | Transparência Eleitoral';
    const controller = new AbortController();
    fetchElectionResults(controller.signal)
      .then((data) => { setSnapshot(data); setSnapshotState(data ? 'ready' : 'error'); })
      .catch((error) => { if (error.name !== 'AbortError') setSnapshotState('error'); });
    return () => controller.abort();
  }, []);

  const source = dataUrl(cargo, uf);
  useEffect(() => {
    const controller = new AbortController();
    setRecords([]);
    setVisibleCount(PAGE_SIZE);
    if (!source) { setRecordsState('idle'); return () => controller.abort(); }
    setRecordsState('loading');
    fetch(source, { cache: 'no-cache', signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Base indisponível'); return response.json(); })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('Formato inesperado');
        setRecords(data);
        setRecordsState('ready');
      })
      .catch((error) => { if (error.name !== 'AbortError') setRecordsState('error'); });
    return () => controller.abort();
  }, [source]);

  const officialCount = useMemo(() => {
    if (!snapshot?.candidaturas) return null;
    return Object.values(snapshot.candidaturas).filter((item) =>
      item.situacao === 'eleito' && item.cargo === cargo && (!uf || item.uf === uf)
    ).length;
  }, [snapshot, cargo, uf]);

  const elected = useMemo(() => {
    if (!snapshot) return [];
    const term = query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return records.filter((candidate) => (!uf || candidate.uf === uf) &&
      statusMatches(candidate, cargo, snapshot) &&
      (!term || [candidate.nome, candidate.nome_urna, candidate.partido, candidate.numero].some((value) =>
        String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term)
      ))
    ).sort((a, b) => String(a.nome_urna || a.nome || '').localeCompare(
      String(b.nome_urna || b.nome || ''), 'pt-BR', { sensitivity: 'base' }
    ));
  }, [records, snapshot, cargo, uf, query]);

  const displayed = elected.slice(0, visibleCount);
  const requireUf = cargo !== 'presidente' && cargo !== 'deputado-federal';

  function changeCargo(next) {
    setCargo(next);
    setUf('');
    setQuery('');
  }

  return (
    <div className="info-page elected-page">
      <PlatformHeader current="eleitos" />
      <main className="elected-main">
        <nav aria-label="Caminho da página" className="elected-breadcrumb"><a href="/">Início</a><span aria-hidden="true">›</span><span>Eleitas e eleitos</span></nav>
        <header className="elected-hero">
          <span className="elected-kicker">ARQUIVO HISTÓRICO · ELEIÇÕES 2026</span>
          <h1>Eleitas e eleitos</h1>
          <p>Consulta apartidária das pessoas eleitas nas Eleições Gerais de 2026, conforme o resultado oficial do Tribunal Superior Eleitoral. Não atribuímos notas, classificações ou recomendações.</p>
          <a href={OFFICIAL_RESULTS_URL} target="_blank" rel="noreferrer">Conferir a totalização no TSE ↗</a>
        </header>

        <section className="elected-controls" aria-label="Filtros de consulta">
          <label><span>Cargo</span><select value={cargo} onChange={(event) => changeCargo(event.target.value)}>{CARGOS.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>
          {cargo !== 'presidente' && <label><span>Unidade da Federação</span><select value={uf} onChange={(event) => { setUf(event.target.value); setQuery(''); }}><option value="">{requireUf ? 'Selecione uma UF' : 'Brasil — todas as UFs'}</option>{ELECTORATE_BY_UF.map((item) => <option key={item.uf} value={item.uf}>{item.uf} — {item.name}</option>)}</select></label>}
          <label><span>Buscar entre eleitas e eleitos</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Nome, partido ou número" disabled={recordsState !== 'ready'} /></label>
        </section>

        <section className="elected-results" aria-live="polite" aria-labelledby="elected-results-title">
          <div className="elected-results-heading"><h2 id="elected-results-title">Resultado oficial</h2><p>{officialCount === null ? 'Consultando o snapshot…' : `${formatInteger(officialCount)} pessoa(s) eleita(s) no recorte`}</p></div>
          {snapshotState === 'error' && <p className="elected-state" role="alert">O snapshot oficial arquivado não está disponível. Não é possível confirmar eleitas e eleitos nesta consulta.</p>}
          {snapshotState !== 'error' && requireUf && !uf && <p className="elected-state">Escolha uma unidade da Federação para consultar os nomes. A base estadual é carregada apenas quando necessária.</p>}
          {snapshotState !== 'error' && recordsState === 'loading' && <p className="elected-state" role="status">Carregando candidaturas da circunscrição…</p>}
          {snapshotState !== 'error' && recordsState === 'error' && <p className="elected-state" role="alert">Não foi possível carregar os registros da circunscrição. Nenhum resultado será presumido.</p>}
          {snapshotState === 'ready' && recordsState === 'ready' && elected.length === 0 && <p className="elected-state">Nenhum registro confirmado corresponde aos filtros desta consulta.</p>}
          {snapshotState === 'ready' && recordsState === 'ready' && elected.length > 0 && <>
            <p className="elected-found">{formatInteger(elected.length)} registro(s) localizado(s) na base arquivada; ordem alfabética.</p>
            <div className="elected-list">{displayed.map((candidate) => (
              <article key={candidate.id_tse} className="elected-card">
                <div><span className="elected-tag">{candidate.genero === 'FEMININO' ? 'Eleita' : candidate.genero === 'MASCULINO' ? 'Eleito' : 'Eleito(a)'}</span><h3>{candidate.nome_urna || candidate.nome}</h3><p>{candidate.partido || 'Partido não informado'} · {candidate.uf || 'BR'} · nº {candidate.numero || '—'}</p></div>
                <a href={profileLink(candidate, cargo)} aria-label={`Abrir perfil de ${candidate.nome_urna || candidate.nome}`}>Ver perfil →</a>
              </article>
            ))}</div>
            {elected.length > visibleCount && <button className="elected-more" type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}>Carregar mais resultados</button>}
          </>}
        </section>
        <aside className="elected-method">
          <h2>Como verificamos os resultados?</h2>
          <p>A classificação exige correspondência exata pelo identificador SQ_CANDIDATO e situação “Eleito” publicada pelo TSE em arquivo com totalização concluída. A ausência de registro não é interpretada como derrota. Resultados posteriores podem sofrer decisões judiciais; este é o retrato arquivado em {snapshot?.atualizado_em ? new Date(snapshot.atualizado_em).toLocaleDateString('pt-BR') : '2026'}.</p>
          <p>O arquivo reúne {snapshot?.cobertura?.arquivos_confirmados ?? '—'} arquivos oficiais validados. As respostas 404 de segundo turno em estados sem nova votação não são tratadas como eleições pendentes.</p>
          <a href="/metodologia">Metodologia e fontes →</a>
        </aside>
      </main>
    </div>
  );
}
