import React, { useEffect, useMemo, useState } from 'react';
import { ELECTION_2026, OFFICIAL_SOURCES, findUfFacts, formatInteger, formatRatio } from './election2026Facts.js';
import './electionContext.css';

const CARGOS = {
  presidente: { label: 'Presidência', manifest: '/data/candidatos/presidente/manifest.json' },
  governador: { label: 'Governo estadual', manifest: '/data/candidatos/governador/manifest.json' },
  senador: { label: 'Senado', manifest: '/data/candidatos/senador/manifest.json' },
  'deputado-federal': { label: 'Câmara dos Deputados', manifest: '/data/metadata.json' },
  'deputado-estadual': { label: 'Assembleias e CLDF', manifest: '/data/candidatos/deputado-estadual/manifest.json' },
};

function seatsFor(cargo, uf, results) {
  if (cargo === 'presidente') return 1;
  if (cargo === 'governador') return uf ? 1 : 27;
  if (cargo === 'senador') return uf ? 2 : 54;
  if (cargo === 'deputado-federal') return uf ? findUfFacts(uf)?.federalSeats ?? null : ELECTION_2026.federalDeputySeats;
  if (cargo !== 'deputado-estadual' || !results?.candidaturas) return null;
  // A distribuição estadual/distrital é conferida com os eleitos da totalização oficial.
  return Object.values(results.candidaturas).filter((record) =>
    record.cargo === 'deputado-estadual' && record.situacao === 'eleito' && (!uf || record.uf === uf)
  ).length || null;
}

export default function ElectionContext({ cargo, uf, candidates = [], candidateStatus, results }) {
  const [manifest, setManifest] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const config = CARGOS[cargo];

  useEffect(() => {
    if (!config) return undefined;
    const controller = new AbortController();
    setLoadState('loading');
    setManifest(null);
    fetch(config.manifest, { signal: controller.signal, cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error('Manifesto indisponível');
        return response.json();
      })
      .then((data) => { setManifest(data); setLoadState('ready'); })
      .catch((error) => { if (error.name !== 'AbortError') setLoadState('error'); });
    return () => controller.abort();
  }, [cargo, config?.manifest]);

  const facts = findUfFacts(uf);
  const seats = useMemo(() => seatsFor(cargo, uf, results), [cargo, uf, results]);
  const count = useMemo(() => {
    if (loadState !== 'ready') return null;
    if (cargo === 'deputado-federal') {
      if (candidateStatus !== 'ready') return null;
      return uf ? candidates.filter((candidate) => candidate.uf === uf).length : candidates.length;
    }
    if (uf && cargo !== 'presidente') return manifest?.ufs?.[uf]?.total ?? null;
    return manifest?.total ?? null;
  }, [cargo, uf, manifest, candidates, candidateStatus, loadState]);

  if (!config) return null;
  const electorate = uf && cargo !== 'presidente' ? facts?.electorate ?? null : ELECTION_2026.electorateTotal;
  const scopeLabel = uf && cargo !== 'presidente' ? `${facts?.name || uf} (${uf})` : 'Brasil';
  const ratio = Number.isFinite(count) && seats ? count / seats : null;

  return (
    <section className="election-context" aria-labelledby="election-context-title">
      <div className="election-context-heading">
        <div>
          <span className="election-context-kicker">PANORAMA ELEITORAL · 2026</span>
          <h2 id="election-context-title">{config.label} · {scopeLabel}</h2>
        </div>
        <a href="/eleitos">Consultar eleitas e eleitos →</a>
      </div>
      <dl className="election-context-grid" aria-busy={loadState === 'loading'}>
        <div><dt>Candidaturas na base</dt><dd>{count === null ? '—' : formatInteger(count)}</dd></div>
        <div><dt>Vagas em disputa</dt><dd>{seats === null ? '—' : formatInteger(seats)}</dd></div>
        <div><dt>Candidaturas por vaga</dt><dd>{ratio === null ? '—' : formatRatio(ratio)}</dd></div>
        <div><dt>Eleitorado apto</dt><dd>{electorate === null ? '—' : formatInteger(electorate)}</dd></div>
      </dl>
      <p className="election-context-note">
        Candidaturas são registros da última carga arquivada; a relação por vaga é descritiva, não probabilidade de eleição.
        O eleitorado usa o recorte consolidado de {ELECTION_2026.electorateReferenceDate}; para estadual/distrital, as vagas são
        conferidas pelo total de eleitas e eleitos da base oficial do TSE.
        {' '}<a href={OFFICIAL_SOURCES.candidatesOpenData} target="_blank" rel="noreferrer">Candidaturas — TSE ↗</a>
        {' · '}<a href={OFFICIAL_SOURCES.electorateOpenData} target="_blank" rel="noreferrer">Eleitorado — TSE ↗</a>
        {' · '}<a href="/entenda#eleitorado">Eleitorado por UF</a>
      </p>
      {loadState === 'error' && <p role="status">A contagem de candidaturas está indisponível nesta consulta. Não exibimos valores estimados.</p>}
    </section>
  );
}
