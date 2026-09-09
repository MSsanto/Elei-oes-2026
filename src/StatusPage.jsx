import React, { useEffect, useMemo, useState } from 'react';
import PlatformHeader from './PlatformHeader.jsx';
import './statusPage.css';

const CHECKS = [
  { id: 'candidatos', label: 'Candidaturas — TSE', url: '/data/candidatos/manifest.json', sla: 12 },
  { id: 'financas', label: 'Finanças de campanha — TSE', url: '/data/financas-2026/manifest.json', sla: 18 },
  { id: 'camara', label: 'Histórico — Câmara', url: '/data/camara/metadata.json', sla: 36 },
];

function parseGeneratedAt(payload) {
  return payload?.generated_at_utc || payload?.generated_at || null;
}

function formatDate(value) {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data inválida';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function hoursSince(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - time) / 3_600_000);
}

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function CheckRow({ check }) {
  const label = check.status === 'ok' ? 'Operacional' : check.status === 'stale' ? 'Desatualizado' : 'Indisponível';
  return (
    <li className="status-check-row">
      <span className={`status-dot status-dot--${check.status}`} aria-hidden="true" />
      <span className="status-check-copy">
        <strong>{check.label}</strong>
        <small>Última carga: {formatDate(check.generatedAt)} · SLA: {check.sla}h</small>
      </span>
      <span className={`status-pill status-pill--${check.status}`}>{label}</span>
    </li>
  );
}

export default function StatusPage() {
  const [state, setState] = useState({ loading: true, checks: [], collection: null, loadError: null });

  useEffect(() => {
    let active = true;
    document.title = 'Status e Qualidade | Eleições 2026';

    async function load() {
      const results = await Promise.allSettled(CHECKS.map((item) => loadJson(item.url)));
      const checks = CHECKS.map((item, index) => {
        const result = results[index];
        if (result.status !== 'fulfilled') {
          return { ...item, status: 'error', generatedAt: null, detail: result.reason?.message || 'Falha de leitura' };
        }
        const generatedAt = parseGeneratedAt(result.value);
        const age = hoursSince(generatedAt);
        return {
          ...item,
          status: age <= item.sla ? 'ok' : 'stale',
          generatedAt,
          age,
          payload: result.value,
        };
      });

      let collection = null;
      try {
        collection = await loadJson('/data/status/finance-collection.json');
      } catch {
        collection = null;
      }

      if (active) setState({ loading: false, checks, collection, loadError: null });
    }

    load().catch((error) => {
      if (active) setState({ loading: false, checks: [], collection: null, loadError: error.message });
    });
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => {
    const total = state.checks.length;
    const healthy = state.checks.filter((item) => item.status === 'ok').length;
    const stale = state.checks.filter((item) => item.status === 'stale').length;
    const errors = state.checks.filter((item) => item.status === 'error').length;
    const collectorIncident = state.collection?.status === 'error' ? 1 : 0;
    const percentage = total ? Math.round((healthy / total) * 100) : 0;
    return { total, healthy, stale, errors, incidents: stale + errors + collectorIncident, percentage };
  }, [state]);

  const financeCheck = state.checks.find((item) => item.id === 'financas');
  const collectionIncident = state.collection?.status === 'error';

  return (
    <div className="info-page">
      <PlatformHeader current="status" />
      <main className="info-main status-main">
        <div className="info-breadcrumb"><a href="/">Início</a> <span aria-hidden="true">›</span> Status e Qualidade</div>
        <span className="info-kicker">TRANSPARÊNCIA OPERACIONAL</span>
        <h1>Status e Qualidade</h1>
        <p className="info-lead">Checks de atualização, incidentes e qualidade das fontes usadas pela plataforma. Falhas da nossa infraestrutura são separadas de alterações ou indisponibilidades das fontes oficiais.</p>

        {state.loading ? (
          <section className="info-section"><p>Verificando o estado das cargas…</p></section>
        ) : (
          <>
            <section className="status-summary" aria-label="Resumo de saúde da plataforma">
              <article><small>Saúde das cargas</small><strong>{summary.percentage}%</strong><span>{summary.healthy}/{summary.total} dentro do SLA</span></article>
              <article><small>Incidentes detectados</small><strong>{summary.incidents}</strong><span>checks e coletores</span></article>
              <article><small>Cargas desatualizadas</small><strong>{summary.stale}</strong><span>fora do SLA editorial</span></article>
              <article><small>Checks indisponíveis</small><strong>{summary.errors}</strong><span>falhas de leitura</span></article>
            </section>

            <section className="info-section">
              <div className="status-section-heading">
                <div><span className="info-kicker">CHECKS AUTOMÁTICOS</span><h2>Atualização das fontes</h2></div>
                <span className={`status-pill ${summary.stale || summary.errors ? 'status-pill--stale' : 'status-pill--ok'}`}>
                  {summary.stale || summary.errors ? 'Atenção necessária' : 'Operacional'}
                </span>
              </div>
              {state.loadError ? <p>Não foi possível concluir os checks: {state.loadError}</p> : <ul className="status-check-list">{state.checks.map((item) => <CheckRow key={item.id} check={item} />)}</ul>}
            </section>

            <section className="info-section">
              <span className="info-kicker">INCIDENTES E ERROS</span>
              <h2>Ocorrências ativas</h2>
              {collectionIncident ? (
                <article className="status-incident">
                  <div className="status-incident-head">
                    <div><strong>FIN-001 · Coleta financeira não atualizada</strong><small>Detectado em {formatDate(state.collection.generated_at)}</small></div>
                    <span className="status-pill status-pill--error">Alta</span>
                  </div>
                  <p>{state.collection.message}</p>
                  <dl>
                    <div><dt>Origem</dt><dd>Infraestrutura de coleta</dd></div>
                    <div><dt>Componente</dt><dd>Browser Worker</dd></div>
                    <div><dt>Impacto</dt><dd>O último snapshot financeiro válido continua publicado, mas pode estar fora do SLA de 18h.</dd></div>
                    <div><dt>Último erro</dt><dd>{state.collection.last_error || 'Não informado'}</dd></div>
                  </dl>
                </article>
              ) : financeCheck?.status === 'stale' ? (
                <article className="status-incident">
                  <div className="status-incident-head"><strong>FIN-001 · Snapshot financeiro fora do SLA</strong><span className="status-pill status-pill--stale">Média</span></div>
                  <p>A carga financeira está desatualizada. O sistema preserva o último conjunto validado em vez de publicar uma coleta incompleta.</p>
                </article>
              ) : (
                <p className="status-empty">Nenhum incidente operacional ativo registrado.</p>
              )}
            </section>

            <section className="info-section">
              <span className="info-kicker">COMO INTERPRETAR</span>
              <h2>Erro da plataforma ≠ problema na fonte</h2>
              <div className="status-origin-grid">
                <article><strong>Plataforma</strong><p>Falha no código, processamento, interface, configuração ou associação feita pelo projeto.</p></article>
                <article><strong>Infraestrutura de coleta</strong><p>Falha no mecanismo usado para obter ou transportar os dados, sem atribuir automaticamente o problema ao órgão oficial.</p></article>
                <article><strong>Fonte oficial</strong><p>Campo ausente, mudança ou indisponibilidade identificada no dado público de origem. Isso não é rotulado como erro do projeto.</p></article>
              </div>
            </section>

            <section className="info-section">
              <span className="info-kicker">POLÍTICA DE PUBLICAÇÃO</span>
              <h2>Dados inválidos não substituem uma carga válida</h2>
              <p>Os checks de frescor não são afrouxados para esconder atrasos. Se uma nova coleta falhar, a plataforma mantém o último snapshot validado, registra o incidente e sinaliza quando a informação ultrapassa o SLA definido.</p>
              <div className="info-links"><a href="/correcoes">Política de correções</a><a href="/metodologia">Metodologia</a><a href="/fontes">Fontes</a></div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
