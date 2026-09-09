import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ELECTION_2026, OFFICIAL_SOURCES, findUfFacts, formatInteger, formatRatio } from './election2026Facts.js';
import './federalElectionStats.css';

const DATA_URL = '/data/deputados_federais.json';

function readContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    cargo: params.get('cargo') || 'deputado-federal',
    uf: String(params.get('uf') || '').toUpperCase(),
  };
}

export default function FederalElectionStats() {
  const [context, setContext] = useState(readContext);
  const [mountNode, setMountNode] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();
    fetch(DATA_URL, { cache: 'no-cache', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        setCandidates(Array.isArray(payload) ? payload : []);
        setStatus('ready');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Falha ao carregar panorama eleitoral.', error);
          setStatus('error');
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let ownedNode = null;
    let syncTimer = null;

    const sync = () => {
      const next = readContext();
      setContext((current) => (current.cargo === next.cargo && current.uf === next.uf ? current : next));

      if (next.cargo !== 'deputado-federal') {
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

  const stats = useMemo(() => {
    const ufFacts = findUfFacts(context.uf);
    const scopedCandidates = ufFacts ? candidates.filter((candidate) => candidate?.uf === ufFacts.uf) : candidates;
    const seats = ufFacts ? ufFacts.federalSeats : ELECTION_2026.federalDeputySeats;
    const electorate = ufFacts ? ufFacts.electorate : ELECTION_2026.electorateTotal;
    return {
      label: ufFacts ? `${ufFacts.name} (${ufFacts.uf})` : 'Brasil',
      candidates: scopedCandidates.length,
      seats,
      ratio: seats ? scopedCandidates.length / seats : 0,
      electorate,
    };
  }, [candidates, context.uf]);

  if (!mountNode || context.cargo !== 'deputado-federal') return null;

  return createPortal(
    <section className="federal-election-stats" aria-labelledby="federal-election-stats-title">
      <div className="federal-election-stats-heading">
        <div>
          <span>PANORAMA DA DISPUTA</span>
          <h2 id="federal-election-stats-title">{stats.label}</h2>
        </div>
        <a href="/entenda#eleitorado">Ver eleitorado por UF →</a>
      </div>

      <div className="federal-election-stats-grid">
        <div className="federal-election-stat">
          <strong>{status === 'ready' ? formatInteger(stats.candidates) : '—'}</strong>
          <span>candidaturas na base</span>
        </div>
        <div className="federal-election-stat">
          <strong>{formatInteger(stats.seats)}</strong>
          <span>vagas na Câmara</span>
        </div>
        <div className="federal-election-stat federal-election-stat-accent">
          <strong>{status === 'ready' ? formatRatio(stats.ratio) : '—'}</strong>
          <span>candidatos por vaga</span>
        </div>
        <div className="federal-election-stat">
          <strong>{formatInteger(stats.electorate)}</strong>
          <span>eleitores aptos</span>
        </div>
      </div>

      <p className="federal-election-stats-note">
        A concorrência é calculada com a carga de candidaturas publicada nesta plataforma e pode mudar com julgamentos, renúncias e substituições. Eleitorado: referência de {ELECTION_2026.electorateReferenceDate}. Vagas: 513 em 2026.
      </p>
      <div className="federal-election-stats-links">
        <a href={OFFICIAL_SOURCES.candidatesOpenData} target="_blank" rel="noreferrer">Candidaturas — TSE ↗</a>
        <a href={OFFICIAL_SOURCES.electorateOpenData} target="_blank" rel="noreferrer">Eleitorado — TSE ↗</a>
        <a href={OFFICIAL_SOURCES.federalSeats2026} target="_blank" rel="noreferrer">Vagas — Câmara ↗</a>
      </div>
      {status === 'error' && <p className="federal-election-stats-error">A contagem de candidaturas não pôde ser carregada agora; vagas e eleitorado permanecem disponíveis.</p>}
    </section>,
    mountNode,
  );
}
