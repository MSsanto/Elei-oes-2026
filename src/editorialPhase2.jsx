import React, { useEffect, useMemo, useState } from 'react';
import PlatformHeader from './PlatformHeader.jsx';
import './editorialPhase2.css';

const TSE_FINANCE_URL = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/prestacao-de-contas-eleitorais-2026';

function money(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(Number.isFinite(number) ? number : 0);
}
function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date);
}
function setMeta(title, description, canonicalPath) {
  document.title = title;
  let descriptionNode = document.querySelector('meta[name="description"]');
  if (!descriptionNode) {
    descriptionNode = document.createElement('meta');
    descriptionNode.name = 'description';
    document.head.appendChild(descriptionNode);
  }
  descriptionNode.content = description;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = new URL(canonicalPath, window.location.origin).href;
}

function LoadingPage({ label = 'Carregando dados editoriais…' }) {
  return <div className="editorial-loading" aria-live="polite"><span/><span/><span/><p>{label}</p></div>;
}
function DataError() {
  return <div className="editorial-state"><strong>Não foi possível carregar esta camada de dados.</strong><span>A consulta principal continua disponível. Tente novamente ou consulte a fonte oficial.</span><a href={TSE_FINANCE_URL} target="_blank" rel="noreferrer">Abrir dados oficiais do TSE ↗</a></div>;
}
function EditorialShell({ current, kicker, title, lead, children }) {
  return <div className="editorial-page"><PlatformHeader current={current}/><main className="editorial-main"><header className="editorial-hero"><span className="editorial-kicker">{kicker}</span><h1>{title}</h1><p>{lead}</p></header>{children}</main></div>;
}

function RadarEvent({ event }) {
  const finance = event.type === 'financas';
  return <article className="radar-event">
    <div className="radar-event-time"><time dateTime={event.timestamp}>{dateTime(event.timestamp)}</time><span>{finance ? 'Finanças' : 'Cadastro'}</span></div>
    <div className="radar-event-copy">
      <h2>{event.title}</h2>
      <p className="radar-candidate-line">{event.candidate_name}{event.partido ? ` · ${event.partido}` : ''}{event.uf ? ` · ${event.uf}` : ''}{event.cargo ? ` · ${event.cargo}` : ''}</p>
      {finance && event.before !== undefined && <div className="radar-money-change"><span>Antes <strong>{money(event.before)}</strong></span><span>Depois <strong>{money(event.after)}</strong></span><span>Variação <strong>{money(event.delta)}</strong></span></div>}
      {event.detail && <p className="radar-detail">{event.detail}</p>}
      {event.href && <a className="editorial-link" href={event.href}>Abrir candidatura →</a>}
    </div>
  </article>;
}

export function RadarPage() {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [filter, setFilter] = useState('todos');
  useEffect(() => {
    setMeta('Radar Eleitoral | Eleições 2026 — Transparência Eleitoral', 'Alterações detectadas entre cargas processadas das fontes eleitorais oficiais.', '/radar');
    fetch('/data/editorial/radar.json', { cache: 'no-cache' }).then((response) => {
      if (!response.ok) throw new Error('radar');
      return response.json();
    }).then((payload) => { setData(payload); setState('ready'); }).catch(() => setState('error'));
  }, []);
  const events = useMemo(() => (data?.events || []).filter((event) => filter === 'todos' || event.type === filter), [data, filter]);
  return <EditorialShell current="radar" kicker="FASE EDITORIAL · RADAR" title="O que mudou nas cargas oficiais" lead="O Radar registra diferenças observadas entre duas cargas processadas. Mudança de dado não é tratada como irregularidade: é apenas uma alteração publicada e detectada pelo pipeline.">
    {state === 'loading' && <LoadingPage label="Comparando as cargas disponíveis…"/>}
    {state === 'error' && <DataError/>}
    {state === 'ready' && <>
      <section className="editorial-context-strip"><span>Atualização da carga <strong>{dateTime(data.generated_at_utc)}</strong></span><span>Eventos preservados <strong>{(data.events || []).length.toLocaleString('pt-BR')}</strong></span><a href={data.source_url || TSE_FINANCE_URL} target="_blank" rel="noreferrer">Fonte oficial ↗</a></section>
      <section className="radar-toolbar" aria-label="Filtrar Radar">
        {[['todos','Todos'],['financas','Finanças'],['cadastro','Cadastro']].map(([key,label]) => <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key)} aria-pressed={filter === key}>{label}</button>)}
      </section>
      {data.mode === 'baseline' && <div className="editorial-state baseline"><strong>Linha de base estabelecida.</strong><span>{data.methodology}</span></div>}
      {data.mode !== 'baseline' && !events.length && <div className="editorial-state"><strong>Nenhuma alteração deste tipo foi detectada na comparação disponível.</strong><span>Isso descreve apenas as cargas processadas pelo projeto.</span></div>}
      <section className="radar-list" aria-live="polite">{events.map((event) => <RadarEvent event={event} key={event.id}/>)}</section>
      <details className="editorial-method"><summary>Como funciona o Radar</summary><p>{data.methodology}</p><p>Os eventos são descritivos e usam os mesmos campos para todas as candidaturas. Ausência de evento não significa ausência de atividade na fonte.</p></details>
    </>}
  </EditorialShell>;
}

function MetricCard({ label, value, note }) {
  return <div className="money-metric"><span>{label}</span><strong>{money(value)}</strong><small>{note}</small></div>;
}
function AggregateBars({ title, subtitle, rows }) {
  const values = Array.isArray(rows) ? [...rows].sort((a,b) => Number(b.valor || 0) - Number(a.valor || 0)) : [];
  const max = Math.max(1, ...values.map((item) => Number(item.valor || 0)));
  return <article className="money-panel"><div className="money-panel-heading"><h2>{title}</h2><p>{subtitle}</p></div><div className="aggregate-bars">{values.map((item) => <div className="aggregate-row" key={item.categoria}><div><span>{item.categoria}</span><strong>{money(item.valor)}</strong></div><div className="aggregate-track" aria-hidden="true"><span style={{ width: `${Math.max(1.5, Number(item.valor || 0) / max * 100)}%` }}/></div></div>)}</div></article>;
}

export function MoneyPage() {
  const [data, setData] = useState(null);
  const [suppliers, setSuppliers] = useState(null);
  const [state, setState] = useState('loading');
  const [query, setQuery] = useState('');
  useEffect(() => {
    setMeta('Siga o Dinheiro | Eleições 2026 — Transparência Eleitoral', 'Visão agregada e descritiva das receitas, despesas e fornecedores publicados na prestação de contas eleitoral processada.', '/siga-o-dinheiro');
    Promise.all([
      fetch('/data/editorial/finance-overview.json', { cache: 'no-cache' }).then((response) => { if (!response.ok) throw new Error('finance'); return response.json(); }),
      fetch('/data/editorial/fornecedores/index.json', { cache: 'no-cache' }).then((response) => { if (!response.ok) throw new Error('suppliers'); return response.json(); }),
    ]).then(([finance, supplierIndex]) => { setData(finance); setSuppliers(supplierIndex); setState('ready'); }).catch(() => setState('error'));
  }, []);
  const visibleSuppliers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    const rows = suppliers?.records || [];
    if (!needle) return rows.slice(0, 80);
    return rows.filter((item) => `${item.nome} ${item.tipo}`.toLocaleLowerCase('pt-BR').includes(needle)).slice(0, 120);
  }, [suppliers, query]);
  return <EditorialShell current="dinheiro" kicker="FASE EDITORIAL · PRESTAÇÃO DE CONTAS" title="Siga o Dinheiro" lead="Uma leitura agregada das receitas e despesas publicadas, sem transformar valor financeiro em nota, ranking de candidatura ou juízo político.">
    {state === 'loading' && <LoadingPage label="Consolidando a prestação de contas processada…"/>}
    {state === 'error' && <DataError/>}
    {state === 'ready' && <>
      <section className="editorial-context-strip"><span>Perfis financeiros <strong>{Number(data.candidaturas_com_financas || 0).toLocaleString('pt-BR')}</strong></span><span>Carga <strong>{dateTime(data.generated_at_utc)}</strong></span><a href={data.source_url || TSE_FINANCE_URL} target="_blank" rel="noreferrer">Prestação de Contas no TSE ↗</a></section>
      <section className="money-metrics"><MetricCard label="Receitas registradas" value={data.total_receitas} note="soma da carga processada"/><MetricCard label="Despesas contratadas" value={data.total_despesas_contratadas} note="obrigações registradas"/><MetricCard label="Despesas pagas" value={data.total_despesas_pagas} note="pagamentos registrados"/></section>
      <section className="money-grid"><AggregateBars title="Fonte dos recursos" subtitle="Categorias oficiais de fonte, agregadas na carga." rows={data.receitas_por_fonte}/><AggregateBars title="Origem das receitas" subtitle="Classificações oficiais de origem." rows={data.receitas_por_origem}/></section>
      <AggregateBars title="Onde os recursos foram contratados" subtitle="Categorias oficiais de despesas contratadas, agregadas na carga." rows={data.despesas_por_categoria}/>
      <section className="supplier-directory" id="fornecedores"><div className="supplier-directory-heading"><div><span className="editorial-kicker">ENTIDADES DA PRESTAÇÃO</span><h2>Fornecedores publicados</h2><p>{suppliers.note}</p></div><label>Buscar fornecedor<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome ou categoria"/></label></div>
        <div className="supplier-directory-list">{visibleSuppliers.map((supplier) => <a key={supplier.id} className="supplier-row" href={supplier.href}><span><strong>{supplier.nome}</strong><small>{supplier.tipo || 'Classificação não informada'}</small></span><span>{Number(supplier.candidaturas || 0).toLocaleString('pt-BR')} candidatura(s)</span><span>{money(supplier.valor_total)}</span><b aria-hidden="true">→</b></a>)}</div>
        {!visibleSuppliers.length && <div className="editorial-state"><strong>Nenhum fornecedor corresponde à busca.</strong><span>Remova parte do texto para ampliar a consulta.</span></div>}
      </section>
      <details className="editorial-method"><summary>Escopo e metodologia financeira</summary><p>Os totais reproduzem agregações dos registros processados da Prestação de Contas Eleitorais 2026. Categorias são rótulos da própria fonte e não representam avaliação do projeto.</p><p>{data.fornecedores?.note}</p></details>
    </>}
  </EditorialShell>;
}

export function SupplierPage() {
  const pathname = window.location.pathname.replace(/\/+$/, '');
  const token = pathname.split('/').pop() || '';
  const id = token.split('-')[0];
  const [record, setRecord] = useState(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    if (!/^[a-f0-9]{16}$/i.test(id)) { setState('error'); return; }
    fetch(`/data/editorial/fornecedores/shards/${id.slice(0,2).toLowerCase()}.json`, { cache: 'no-cache' })
      .then((response) => { if (!response.ok) throw new Error('supplier'); return response.json(); })
      .then((payload) => {
        const supplier = payload?.[id];
        if (!supplier) throw new Error('missing');
        setRecord(supplier);
        setMeta(`${supplier.nome} | Fornecedor — Eleições 2026`, `Registros de despesas eleitorais associados a ${supplier.nome} na carga processada da prestação de contas 2026.`, pathname);
        setState('ready');
      }).catch(() => setState('error'));
  }, [id, pathname]);
  return <EditorialShell current="dinheiro" kicker="Siga o Dinheiro · Fornecedor" title={record?.nome || 'Fornecedor'} lead={record ? `Registros associados a este nome e classificação na prestação de contas processada. A página é descritiva e não implica relação além dos lançamentos publicados.` : 'Consultando os registros publicados na prestação de contas eleitoral.'}>
    {state === 'loading' && <LoadingPage label="Carregando registros do fornecedor…"/>}
    {state === 'error' && <div className="editorial-state"><strong>Fornecedor não localizado nesta carga editorial.</strong><span>O índice pode ter sido atualizado ou o endereço pode estar incompleto.</span><a href="/siga-o-dinheiro#fornecedores">Voltar ao diretório de fornecedores →</a></div>}
    {state === 'ready' && <>
      <nav className="editorial-breadcrumb" aria-label="Navegação estrutural"><a href="/siga-o-dinheiro">Siga o Dinheiro</a><span>/</span><span>Fornecedor</span></nav>
      <section className="supplier-summary"><div><span>Classificação publicada</span><strong>{record.tipo || 'Não informado'}</strong></div><div><span>Valor contratado associado</span><strong>{money(record.valor_total)}</strong></div><div><span>Candidaturas associadas</span><strong>{Number(record.candidaturas?.length || 0).toLocaleString('pt-BR')}</strong></div></section>
      <section className="supplier-candidates"><div className="money-panel-heading"><h2>Registros por candidatura</h2><p>Lista em ordem alfabética. Os valores são os lançamentos agregados associados a este fornecedor e classificação.</p></div><div className="supplier-candidate-list">{(record.candidaturas || []).map((candidate) => <a className="supplier-candidate-row" href={candidate.href || '#'} key={candidate.id_tse}><span><strong>{candidate.nome}</strong><small>{[candidate.partido,candidate.uf,candidate.cargo].filter(Boolean).join(' · ') || 'Dados cadastrais não localizados nesta camada'}</small></span><strong>{money(candidate.valor)}</strong><b aria-hidden="true">→</b></a>)}</div></section>
      <section className="supplier-source"><span>Fonte</span><a href={record.source_url || TSE_FINANCE_URL} target="_blank" rel="noreferrer">{record.source || 'TSE — Prestação de Contas Eleitorais 2026'} ↗</a><small>Carga: {dateTime(record.generated_at_utc)}</small></section>
      <details className="editorial-method"><summary>Como interpretar esta página</summary><p>A associação apresentada existe porque a prestação de contas processada contém despesa contratada registrada com este nome de fornecedor e esta classificação. O projeto não infere vínculo adicional, regularidade ou irregularidade a partir do registro.</p></details>
    </>}
  </EditorialShell>;
}
