import React, { useEffect, useMemo, useState } from 'react';
import './campaignFinance.css';

const BASE_URL = '/data/financas-2026';
const SHARD_CACHE = new Map();

function financeShard(candidateId) {
  const value = Number(candidateId);
  if (!Number.isFinite(value)) return '';
  return (Math.abs(Math.trunc(value)) % 256).toString(16).padStart(2, '0');
}

async function loadFinanceRecord(candidateId, signal) {
  const shard = financeShard(candidateId);
  if (!shard) return null;
  let payload = SHARD_CACHE.get(shard);
  if (!payload) {
    const response = await fetch(`${BASE_URL}/shards/${shard}.json`, { cache: 'no-cache', signal });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    payload = await response.json();
    SHARD_CACHE.set(shard, payload);
  }
  return payload?.[String(candidateId)] || null;
}

function money(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatDate(value) {
  if (!value) return '';
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

function safeItems(value) {
  return Array.isArray(value) ? value.filter((item) => Number(item?.valor) > 0) : [];
}

function PercentageList({ items, total, limit = 8 }) {
  const rows = safeItems(items).slice(0, limit);
  if (!rows.length) return <p className="finance-empty-inline">Nenhum lançamento publicado nesta dimensão.</p>;

  return (
    <div className="finance-bars">
      {rows.map((item) => {
        const pct = total > 0 ? Math.max(0, Math.min(100, (Number(item.valor) / total) * 100)) : 0;
        return (
          <div className="finance-bar-row" key={`${item.categoria}-${item.valor}`}>
            <div className="finance-bar-label">
              <span>{item.categoria || 'Não informado'}</span>
              <strong>{money(item.valor)}</strong>
            </div>
            <div className="finance-bar-track" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </div>
            <small>{pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do total</small>
          </div>
        );
      })}
    </div>
  );
}

function Donut({ items, total, label }) {
  const rows = safeItems(items).slice(0, 6);
  const segments = useMemo(() => {
    if (!rows.length || total <= 0) return 'var(--finance-donut-empty) 0 100%';
    let cursor = 0;
    return rows.map((item, index) => {
      const start = cursor;
      const portion = Math.max(0, Math.min(100 - cursor, (Number(item.valor) / total) * 100));
      cursor += portion;
      return `var(--finance-${(index % 6) + 1}) ${start}% ${cursor}%`;
    }).concat(cursor < 100 ? [`var(--finance-donut-empty) ${cursor}% 100%`] : []).join(', ');
  }, [rows, total]);

  return (
    <div className="finance-donut-wrap">
      <div className="finance-donut" style={{ background: `conic-gradient(${segments})` }} aria-label={label}>
        <div><strong>{money(total)}</strong><span>total</span></div>
      </div>
      <div className="finance-legend">
        {rows.map((item, index) => (
          <div key={`${item.categoria}-${item.valor}`}>
            <span className="finance-legend-dot" style={{ background: `var(--finance-${(index % 6) + 1})` }} />
            <span>{item.categoria || 'Não informado'}</span>
            <strong>{money(item.valor)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function CounterpartyTable({ title, rows, emptyText }) {
  const items = Array.isArray(rows) ? rows.slice(0, 10) : [];
  return (
    <div className="finance-table-card">
      <h4>{title}</h4>
      {items.length ? (
        <div className="finance-table-scroll">
          <table className="finance-table">
            <thead><tr><th>Nome publicado</th><th>Tipo</th><th>Valor</th></tr></thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.nome}-${item.valor}-${index}`}>
                  <td>{item.nome || 'Não informado'}</td>
                  <td>{item.tipo || '—'}</td>
                  <td>{money(item.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="finance-empty-inline">{emptyText}</p>}
    </div>
  );
}

function Timeline({ rows }) {
  const items = Array.isArray(rows) ? rows : [];
  const maximum = Math.max(0, ...items.flatMap((item) => [Number(item.receitas || 0), Number(item.despesas || 0)]));
  if (!items.length || maximum <= 0) return null;

  return (
    <div className="finance-timeline">
      <div className="finance-section-heading"><div><span>EVOLUÇÃO</span><h4>Movimentação ao longo da campanha</h4></div><small>Valores por mês</small></div>
      <div className="finance-timeline-grid">
        {items.map((item) => (
          <div className="finance-month" key={item.mes}>
            <div className="finance-month-bars" aria-label={`${item.mes}: receitas ${money(item.receitas)}, despesas ${money(item.despesas)}`}>
              <span className="finance-month-revenue" style={{ height: `${Math.max(3, Number(item.receitas || 0) / maximum * 100)}%` }} />
              <span className="finance-month-expense" style={{ height: `${Math.max(3, Number(item.despesas || 0) / maximum * 100)}%` }} />
            </div>
            <strong>{item.mes}</strong>
            <small>+ {money(item.receitas)}</small>
            <small>− {money(item.despesas)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CampaignFinance({ candidate, candidateId }) {
  const resolvedCandidateId = candidateId || candidate?.id_tse || '';
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!resolvedCandidateId) {
      setStatus('missing');
      setData(null);
      return undefined;
    }

    const controller = new AbortController();
    setStatus('loading');
    setData(null);
    loadFinanceRecord(resolvedCandidateId, controller.signal)
      .then((payload) => {
        if (!payload) {
          setStatus('missing');
          return;
        }
        setData(payload);
        setStatus('ready');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error');
      });

    return () => controller.abort();
  }, [resolvedCandidateId]);

  if (status === 'loading') {
    return <section className="campaign-finance"><div className="finance-state"><span className="finance-loader" />Carregando prestação de contas publicada...</div></section>;
  }

  if (status === 'missing') {
    return (
      <section className="campaign-finance">
        <div className="finance-section-heading"><div><span>PRESTAÇÃO DE CONTAS 2026</span><h3>Dinheiro da campanha</h3></div></div>
        <div className="finance-state">
          <strong>Prestação financeira ainda não localizada nesta carga.</strong>
          <span>Isso não significa ausência de movimentação. O painel só é exibido quando há registro oficial processado e vinculado pelo identificador TSE da candidatura.</span>
        </div>
      </section>
    );
  }

  if (status === 'error' || !data) {
    return <section className="campaign-finance"><div className="finance-state"><strong>Não foi possível carregar os dados financeiros desta candidatura.</strong></div></section>;
  }

  const summary = data.resumo || {};
  const revenueTotal = Number(summary.total_receitas || 0);
  const contractedTotal = Number(summary.total_despesas_contratadas || 0);
  const paidTotal = Number(summary.total_despesas_pagas || 0);

  return (
    <section className="campaign-finance">
      <div className="finance-section-heading">
        <div><span>PRESTAÇÃO DE CONTAS 2026 · TSE</span><h3>Dinheiro da campanha</h3></div>
        <small>{data.generated_at_utc ? `Carga: ${formatDate(data.generated_at_utc)}` : 'Fonte oficial processada'}</small>
      </div>

      <div className="finance-summary">
        <div><span>Receitas</span><strong>{money(revenueTotal)}</strong><small>recursos declarados</small></div>
        <div><span>Despesas contratadas</span><strong>{money(contractedTotal)}</strong><small>obrigações registradas</small></div>
        <div><span>Despesas pagas</span><strong>{money(paidTotal)}</strong><small>pagamentos registrados</small></div>
      </div>

      <div className="finance-two-columns">
        <article className="finance-panel">
          <div className="finance-panel-title"><span>DE ONDE VEIO</span><h4>Fonte dos recursos</h4></div>
          <Donut items={data.receitas_por_fonte} total={revenueTotal} label="Distribuição das receitas por fonte oficial" />
        </article>
        <article className="finance-panel">
          <div className="finance-panel-title"><span>COMO ENTROU</span><h4>Origem das receitas</h4></div>
          <PercentageList items={data.receitas_por_origem} total={revenueTotal} />
        </article>
      </div>

      <article className="finance-panel finance-expenses-panel">
        <div className="finance-panel-title"><span>ONDE FOI GASTO</span><h4>Despesas por categoria oficial</h4></div>
        <PercentageList items={data.despesas_por_categoria} total={contractedTotal || paidTotal} limit={12} />
      </article>

      <Timeline rows={data.timeline} />

      <div className="finance-two-columns finance-counterparties">
        <CounterpartyTable title="Principais entradas" rows={data.principais_doadores} emptyText="Nenhum doador/origem individual publicado nesta carga." />
        <CounterpartyTable title="Principais fornecedores" rows={data.principais_fornecedores} emptyText="Nenhum fornecedor publicado nesta carga." />
      </div>

      <p className="finance-footnote">
        Valores e classificações reproduzem registros publicados na Prestação de Contas Eleitorais 2026. As categorias não representam avaliação do projeto. Identificadores fiscais completos não são republicados neste painel.
      </p>
    </section>
  );
}
