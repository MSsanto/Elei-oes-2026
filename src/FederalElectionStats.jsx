import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ELECTION_2026,
  OFFICIAL_SOURCES,
  findUfFacts,
  formatInteger,
  formatRatio,
  stateLegislatureSeats,
} from './election2026Facts.js';
import './federalElectionStats.css';

const SUPPORTED_CARGOS = new Set([
  'presidente',
  'governador',
  'senador',
  'deputado-federal',
  'deputado-estadual',
]);

const CARGO_LABELS = {
  presidente: 'Presidente',
  governador: 'Governador',
  senador: 'Senador',
  'deputado-federal': 'Deputado Federal',
  'deputado-estadual': 'Deputado Estadual / Distrital',
};

const DATA_URLS = {
  presidente: '/data/candidatos/presidente/manifest.json',
  governador: '/data/candidatos/governador/manifest.json',
  senador: '/data/candidatos/senador/manifest.json',
  'deputado-federal': '/data/deputados_federais.json',
  'deputado-estadual': '/data/candidatos/deputado-estadual/manifest.json',
};

function readContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    cargo: params.get('cargo') || 'deputado-federal',
    uf: String(params.get('uf') || '').toUpperCase(),
  };
}

async function loadCandidateCount(cargo, uf, signal) {
  const url = DATA_URLS[cargo];
  if (!url) return null;

  const response = await fetch(url, { cache: 'no-cache', signal });
  if (!response.ok) throw new Error(`Falha ao carregar ${url}: HTTP ${response.status}`);
  const payload = await response.json();

  if (cargo === 'deputado-federal') {
    if (!Array.isArray(payload)) return 0;
    return uf ? payload.filter((candidate) => candidate?.uf === uf).length : payload.length;
  }

  if (cargo === 'presidente') return Number(payload?.total || 0);

  if (uf) return Number(payload?.ufs?.[uf]?.total || 0);
  return Number(payload?.total || 0);
}

function seatCount(cargo, ufFacts) {
  if (cargo === 'presidente') return 1;
  if (cargo === 'governador') return ufFacts ? 1 : 27;
  if (cargo === 'senador') return ufFacts ? 2 : ELECTION_2026.senateSeatsContested2026;
  if (cargo === 'deputado-federal') return ufFacts ? ufFacts.federalSeats : ELECTION_2026.federalDeputySeats;
  if (cargo === 'deputado-estadual') {
    return ufFacts
      ? stateLegislatureSeats(ufFacts.uf)
      : ELECTION_2026.stateDeputySeats + ELECTION_2026.districtDeputySeats;
  }
  return null;
}

function electorateCount(cargo, ufFacts) {
  if (ufFacts) return ufFacts.electorate;
  return cargo === 'presidente' ? ELECTION_2026.electorateTotal : ELECTION_2026.electorateInStates;
}

function seatLabel(cargo, scoped) {
  if (cargo === 'presidente') return 'vaga para presidente';
  if (cargo === 'governador') return scoped ? 'vaga para governador' : 'vagas de governador';
  if (cargo === 'senador') return scoped ? 'vagas para o Senado' : 'vagas para o Senado em 2026';
  if (cargo === 'deputado-federal') return 'vagas na Câmara';
  if (cargo === 'deputado-estadual') return scoped ? 'vagas na casa legislativa' : 'vagas estaduais/distritais';
  return 'vagas';
}

function electorateLabel(cargo, scoped) {
  if (scoped) return 'eleitores aptos na UF';
  if (cargo === 'presidente') return 'eleitores aptos no total';
  return 'eleitores aptos nas 27 UFs';
}

export default function FederalElectionStats() {
  const [context, setContext] = useState(readContext);
  const [mountNode, setMountNode] = useState(null);
  const [candidateCount, setCandidateCount] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let ownedNode = null;
    let syncTimer = null;

    const sync = () => {
      const next = readContext();
      setContext((current) => (
        current.cargo === next.cargo && current.uf === next.uf ? current : next
      ));

      if (!SUPPORTED_CARGOS.has(next.cargo)) {
        if (ownedNode?.isConnected) ownedNode.remove();
        ownedNode = null;
        setMountNode(null);
        return;
      }

      const strip = document.querySelector('.data-strip');
      if (!strip) return;
      if (ownedNode?.isConnected && ownedNode.previousElementSibling === strip) return;

      if (ownedNode?.isConnected) ownedNode.remove();
      ownedNode = document.createElement('div');
      ownedNode.className = 'federal-election-stats-mount';
      strip.insertAdjacentElement('afterend', ownedNode);
      setMountNode(ownedNode);
    };

    const scheduleSync = () => {
      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(sync, 0);
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', scheduleSync);
    document.addEventListener('change', scheduleSync, true);
    document.addEventListener('click', scheduleSync, true);
    sync();

    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', scheduleSync);
      document.removeEventListener('change', scheduleSync, true);
      document.removeEventListener('click', scheduleSync, true);
      window.clearTimeout(syncTimer);
      if (ownedNode?.isConnected) ownedNode.remove();
    };
  }, []);

  useEffect(() => {
    if (!SUPPORTED_CARGOS.has(context.cargo)) return undefined;
    const controller = new AbortController();
    setStatus('loading');
    setCandidateCount(null);

    loadCandidateCount(context.cargo, context.uf, controller.signal)
      .then((count) => {
        setCandidateCount(count);
        setStatus('ready');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Falha ao carregar panorama eleitoral.', error);
          setStatus('error');
        }
      });

    return () => controller.abort();
  }, [context.cargo, context.uf]);

  const stats = useMemo(() => {
    const ufFacts = findUfFacts(context.uf);
    const scoped = Boolean(ufFacts);
    const seats = seatCount(context.cargo, ufFacts);
    const electorate = electorateCount(context.cargo, ufFacts);
    const ratio = seats && Number.isFinite(candidateCount) ? candidateCount / seats : null;
    return {
      cargoLabel: CARGO_LABELS[context.cargo] || context.cargo,
      label: ufFacts ? `${ufFacts.name} (${ufFacts.uf})` : 'Brasil',
      scoped,
      seats,
      electorate,
      ratio,
    };
  }, [candidateCount, context.cargo, context.uf]);

  if (!mountNode || !SUPPORTED_CARGOS.has(context.cargo)) return null;

  return createPortal(
    <section className="federal-election-stats" aria-labelledby="federal-election-stats-title">
      <div className="federal-election-stats-heading">
        <div>
          <span>CONTEXTO DA ELEIÇÃO · TSE</span>
          <h2 id="federal-election-stats-title">{stats.cargoLabel} · {stats.label}</h2>
        </div>
        <a href="/entenda#eleitorado">Ver eleitorado por UF →</a>
      </div>

      <div className="federal-election-stats-grid">
        <div className="federal-election-stat">
          <strong>{status === 'ready' ? formatInteger(candidateCount) : '—'}</strong>
          <span>candidaturas na base</span>
        </div>
        <div className="federal-election-stat">
          <strong>{formatInteger(stats.seats)}</strong>
          <span>{seatLabel(context.cargo, stats.scoped)}</span>
        </div>
        <div className="federal-election-stat federal-election-stat-accent">
          <strong>{status === 'ready' && stats.ratio !== null ? formatRatio(stats.ratio) : '—'}</strong>
          <span>candidaturas por vaga</span>
        </div>
        <div className="federal-election-stat">
          <strong>{formatInteger(stats.electorate)}</strong>
          <span>{electorateLabel(context.cargo, stats.scoped)}</span>
        </div>
      </div>

      <p className="federal-election-stats-note">
        A relação candidaturas/vaga é apenas uma razão aritmética descritiva: não representa chance de eleição, ranking ou avaliação de competitividade.
        A contagem usa os registros presentes na base pública arquivada pelo projeto; situações de candidatura continuam identificadas individualmente.
        Eleitorado: referência consolidada de {ELECTION_2026.electorateReferenceDate}.
      </p>
      <div className="federal-election-stats-links">
        <a href={OFFICIAL_SOURCES.candidatesOpenData} target="_blank" rel="noreferrer">Candidaturas — TSE ↗</a>
        <a href={OFFICIAL_SOURCES.electorateOpenData} target="_blank" rel="noreferrer">Eleitorado — TSE ↗</a>
        <a href={OFFICIAL_SOURCES.vacancies2026} target="_blank" rel="noreferrer">Vagas — TSE ↗</a>
        <a href="/metodologia">Metodologia</a>
      </div>
      {status === 'error' && (
        <p className="federal-election-stats-error">
          A contagem de candidaturas não pôde ser carregada agora; vagas e eleitorado permanecem disponíveis.
        </p>
      )}
    </section>,
    mountNode,
  );
}
