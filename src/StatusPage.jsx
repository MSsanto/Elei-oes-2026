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
  const label = check.status === 'frozen' ? 'Arquivado' : check.status === 'ok' ? 'Operacional' : check.status === 'stale' ? 'Desatualizado' : 'Indisponível';
  return (
    <li className="status-check-row">
      <span className={`status-dot status-dot--${check.status}`} aria-hidden="true" />
      <span className="status-check-copy">
        <strong>{check.label}</strong>
        <small>Última carga preservada: {formatDate(check.generatedAt)} · atualização recorrente suspensa</small>
      </span>
      <span className={`status-pill status-pill--${check.status}`}>{label}</span>
    </li>
  );
}

export default function StatusPage() {
  const [state, setState] = useState({ loading: true, checks: [], collection: null, loadError: null });

  useEffect(() => {
    let active = true;
    document.title = 'Status do Arquivo | Eleições 2026';

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
          status: 'frozen',
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
    const healthy = state.checks.filter((item) => item.status === 'frozen').length;
    const stale = state.checks.filter((item) => item.status === 'stale').length;
    const errors = state.checks.filter((item) => item.status === 'error').length;
    const collectorIncident = 0; // Incidentes da coleta anterior são históricos após o congelamento.
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
        <span className="info-kicker">ARQUIVO HISTÓRICO · 2026</span>
        <h1>Status do Arquivo 2026</h1>
        <p className="info-lead">O ciclo 2026 está encerrado para novas coletas recorrentes desde 22/10/2026. As datas antigas das cargas são esperadas neste arquivo e não constituem, por si, um incidente. <a href="/encerramento-2026">Veja o que foi entregue no projeto</a>.</p>

        {state.loading ? (
          <section className="info-section"><p>Verificando o estado das cargas…</p></section>
        ) : (
          <>
            <section className="status-summary" aria-label="Resumo de saúde da plataforma">
              <article><small>Snapshots legíveis</small><strong>{summary.percentage}%</strong><span>{summary.healthy}/{summary.total} preservados e acessíveis</span></article>
              <article><small>Falhas de leitura</small><strong>{summary.incidents}</strong><span>arquivos consultados</span></article>
              <article><small>Cargas congeladas</small><strong>{summary.healthy}</strong><span>sem atualizações periódicas</span></article>
              <article><small>Checks indisponíveis</small><strong>{summary.errors}</strong><span>falhas de leitura</span></article>
            </section>

            <section className="info-section">
              <div className="status-section-heading">
                <div><span className="info-kicker">PRESERVAÇÃO DOS DADOS</span><h2>Arquivos publicados</h2></div>
                <span className={`status-pill ${summary.stale || summary.errors ? 'status-pill--stale' : 'status-pill--ok'}`}>
                  {summary.errors ? 'Atenção de leitura' : 'Arquivo congelado'}
                </span>
              </div>
              {state.loadError ? <p>Não foi possível concluir os checks: {state.loadError}</p> : <ul className="status-check-list">{state.checks.map((item) => <CheckRow key={item.id} check={item} />)}</ul>}
            </section>

            <section className="info-section">
              <span className="info-kicker">REGISTROS HISTÓRICOS</span>
              <h2>Ocorrências registradas antes do congelamento</h2>
              {collectionIncident ? (
                <article className="status-incident">
                  <div className="status-incident-head">
                    <div><strong>FIN-001 · Coleta financeira não atualizada</strong><small>Detectado em {formatDate(state.collection.generated_at)}</small></div>
                    <span className="status-pill status-pill--stale">Histórico</span>
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
                  <p>Esta é uma carga histórica. O sistema preserva o último conjunto validado, sem retomar a coleta automática.</p>
                </article>
              ) : (
                <p className="status-empty">Nenhuma ocorrência histórica registrada na fonte consultada.</p>
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
              <h2>Última carga válida preservada</h2>
              <p>As coletas recorrentes foram suspensas no encerramento do ciclo. As datas de atualização ficam disponíveis como referência histórica; uma carga inválida não substitui os dados anteriormente validados. A consolidação final pós-segundo turno é uma etapa separada, ainda dependente de validação.</p>
              <div className="info-links"><a href="/correcoes">Política de correções</a><a href="/metodologia">Metodologia</a><a href="/fontes">Fontes</a></div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
