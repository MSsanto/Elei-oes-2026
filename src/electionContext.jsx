import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import './electionContext.css';

const CONTEXT_URL = '/data/election-context.json';
const TSE_CANDIDATES_URL = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026';
const TSE_ELECTORATE_URL = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/eleitorado-2026';
const LOCATION_EVENT = 'election-context-locationchange';

if (typeof window !== 'undefined' && !window.__electionContextHistoryPatched) {
  const patch = (method) => {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args) => {
      const result = original(...args);
      window.dispatchEvent(new Event(LOCATION_EVENT));
      return result;
    };
  };
  patch('pushState');
  patch('replaceState');
  window.__electionContextHistoryPatched = true;
}

function formatInteger(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('pt-BR') : '—';
}

function formatRatio(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(Number(value));
}

function formatDate(value) {
  if (!value) return 'data da carga não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function resolveScope(cargo, uf) {
  if (cargo === 'presidente') return 'BR';
  if (cargo === 'deputado-federal') return uf || 'BR';
  return uf || '';
}

function readContextLocation() {
  const params = new URLSearchParams(window.location.search);
  return {
    cargo: params.get('cargo') || 'deputado-federal',
    uf: String(params.get('uf') || '').toUpperCase(),
  };
}

export default function ElectionContext({ cargo, uf }) {
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();
    fetch(CONTEXT_URL, { cache: 'no-cache', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Contexto eleitoral indisponível');
        return response.json();
      })
      .then((data) => {
        setPayload(data);
        setStatus('ready');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('unavailable');
      });
    return () => controller.abort();
  }, []);

  const scope = resolveScope(cargo, uf);
  const context = useMemo(() => {
    if (!scope || !payload) return null;
    return payload?.cargos?.[cargo]?.scopes?.[scope] || null;
  }, [cargo, payload, scope]);

  if (!scope) return null;

  if (status === 'loading') {
    return <div className="election-context-shell"><div className="election-context-skeleton" aria-hidden="true" /></div>;
  }

  if (status === 'unavailable' || !context) {
    return (
      <section className="election-context-shell" aria-label="Contexto eleitoral">
        <div className="election-context-unavailable">
          <strong>Contexto da eleição</strong>
          <span>Vagas e eleitorado aguardando uma carga oficial válida.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="election-context-shell" aria-labelledby="election-context-title">
      <div className="election-context-heading">
        <div>
          <span className="election-context-kicker">CONTEXTO DA ELEIÇÃO · TSE</span>
          <h2 id="election-context-title">{scope === 'BR' ? 'Brasil' : scope}</h2>
        </div>
        <span className="election-context-updated">Carga: {formatDate(payload.generated_at_utc)}</span>
      </div>

      <dl className="election-context-grid">
        <div>
          <dt>Candidaturas</dt>
          <dd>{formatInteger(context.candidates)}</dd>
          <span>registros na base atual</span>
        </div>
        <div>
          <dt>Vagas</dt>
          <dd>{formatInteger(context.seats)}</dd>
          <span>em disputa para o cargo</span>
        </div>
        <div>
          <dt>Candidaturas por vaga</dt>
          <dd>{formatRatio(context.candidates_per_seat)}</dd>
          <span>razão aritmética descritiva</span>
        </div>
        <div>
          <dt>Eleitorado apto</dt>
          <dd>{formatInteger(context.eligible_voters)}</dd>
          <span>{scope === 'BR' ? 'total nacional' : 'na UF selecionada'}</span>
        </div>
      </dl>

      <p className="election-context-note">
        A relação candidaturas/vaga não representa chance de eleição, ranking ou avaliação de competitividade.
        {' '}<a href={TSE_CANDIDATES_URL} target="_blank" rel="noreferrer">Vagas e candidaturas — TSE ↗</a>
        {' · '}<a href={TSE_ELECTORATE_URL} target="_blank" rel="noreferrer">Eleitorado — TSE ↗</a>
        {' · '}<a href="/metodologia">Metodologia</a>
      </p>
    </section>
  );
}

export function ElectionContextPortal() {
  const [target, setTarget] = useState(null);
  const [location, setLocation] = useState(() => readContextLocation());

  useEffect(() => {
    const hero = document.querySelector('.consult-hero');
    if (!hero) return undefined;
    const mount = document.createElement('div');
    mount.className = 'election-context-portal';
    hero.insertAdjacentElement('afterend', mount);
    setTarget(mount);
    return () => mount.remove();
  }, []);

  useEffect(() => {
    const sync = () => setLocation(readContextLocation());
    window.addEventListener(LOCATION_EVENT, sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener(LOCATION_EVENT, sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  return target ? createPortal(<ElectionContext cargo={location.cargo} uf={location.uf} />, target) : null;
}
