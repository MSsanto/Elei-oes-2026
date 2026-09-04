import React, { useEffect, useMemo, useState } from 'react';
import './chamberProfile.css';

export function displayTseValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (!text || text.startsWith('#')) return null;
  return text;
}

export function chamberBasePhoto(candidate) {
  const detail = candidate?.camara_base?.detalhe;
  const data = Array.isArray(detail) ? detail[0] : detail;
  return data?.ultimoStatus?.urlFoto || data?.urlFoto || null;
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
}

function formatCompactMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(number);
}

function formatDate(value) {
  if (!value) return '—';
  const raw = new Date(value);
  if (Number.isNaN(raw.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR').format(raw);
}

function legislatureLabel(value) {
  const id = Number(value);
  const known = {
    54: '54ª (2011–2015)',
    55: '55ª (2015–2019)',
    56: '56ª (2019–2023)',
    57: '57ª (2023–2027)',
  };
  return known[id] || (value ? `${value}ª legislatura` : '—');
}

function periodLabel(data, fallback = '2023–2026') {
  const period = data?.periodo;
  if (period?.inicio && period?.fim) {
    return Number(period.inicio) === Number(period.fim) ? String(period.inicio) : `${period.inicio}–${period.fim}`;
  }
  if (data?.ano) return String(data.ano);
  return fallback;
}

function SourceLink({ href, children }) {
  if (!href) return null;
  return <a className="source-link" href={href} target="_blank" rel="noreferrer">{children} ↗</a>;
}

function EmptyBlock({ children }) {
  return <p className="activity-empty">{children}</p>;
}

function YearSelector({ years, selected, onChange }) {
  if (!years.length) return null;
  return (
    <div className="activity-year-selector" aria-label="Período da atividade parlamentar">
      <span className="activity-year-selector-label">Período</span>
      <div className="activity-year-buttons" role="group" aria-label="Selecionar período">
        <button
          type="button"
          className={selected === 'all' ? 'active' : ''}
          onClick={() => onChange('all')}
          aria-pressed={selected === 'all'}
        >
          4 anos
        </button>
        {years.map((year) => (
          <button
            type="button"
            key={year}
            className={String(selected) === String(year) ? 'active' : ''}
            onClick={() => onChange(String(year))}
            aria-pressed={String(selected) === String(year)}
          >
            {year}
          </button>
        ))}
      </div>
    </div>
  );
}

function sectionForPeriod(profile, section, selectedYear) {
  if (!profile) return null;
  if (selectedYear === 'all') return profile?.[section] || null;
  const year = Number(selectedYear);
  const block = profile?.anos?.[String(year)]?.[section];
  if (!block) return null;
  return {
    ...block,
    periodo: { inicio: year, fim: year },
  };
}

function AnnualBreakdown({ items, valueKey = 'quantidade_registros', money = false, label }) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return null;

  const values = rows.map((item) => Number(item?.[valueKey] || 0));
  const max = Math.max(...values, 1);

  return (
    <div className="annual-breakdown" aria-label={label || 'Evolução anual'}>
      <div className="annual-breakdown-heading">
        <strong>{label || 'Evolução anual'}</strong>
        <span>Dados oficiais consolidados por ano</span>
      </div>
      <div className="annual-breakdown-grid">
        {rows.map((item) => {
          const value = Number(item?.[valueKey] || 0);
          return (
            <div className="annual-year" key={item.ano}>
              <div className="annual-year-top">
                <span>{item.ano}</span>
                <strong>{money ? formatCompactMoney(value) : value.toLocaleString('pt-BR')}</strong>
              </div>
              <div className="annual-year-track" aria-hidden="true">
                <div className="annual-year-fill" style={{ width: `${Math.max(value ? 5 : 0, (value / max) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VoteDistributionChart({ data }) {
  const items = Array.isArray(data?.registros_recentes) ? data.registros_recentes : [];
  const distribution = useMemo(() => {
    const counts = new Map();
    items.forEach((item) => {
      const label = String(item?.voto || 'Não informado').trim() || 'Não informado';
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
  }, [items]);

  if (!distribution.length) return null;
  const max = Math.max(...distribution.map((item) => item.count), 1);

  return (
    <div className="vote-chart" aria-label="Distribuição dos votos e posicionamentos recentes carregados">
      <div className="vote-chart-heading">
        <strong>Distribuição da amostra recente</strong>
        <span>{items.length.toLocaleString('pt-BR')} registro(s) recentes do período</span>
      </div>
      <div className="vote-chart-bars">
        {distribution.map((item) => (
          <div className="vote-chart-row" key={item.label}>
            <span>{item.label}</span>
            <div className="vote-chart-track" aria-hidden="true">
              <div className="vote-chart-fill" style={{ width: `${Math.max(7, (item.count / max) * 100)}%` }} />
            </div>
            <strong>{item.count.toLocaleString('pt-BR')}</strong>
          </div>
        ))}
      </div>
      <p className="chart-scope-note">
        O gráfico de distribuição usa somente os registros recentes mantidos no perfil. Os totais anuais acima representam toda a carga localizada para cada ano.
      </p>
    </div>
  );
}

function MandateSection({ identity, profile, candidate }) {
  const chamber = identity?.camara || {};
  const history = profile?.mandato?.historico || candidate?.camara_base?.historico || [];

  return (
    <details className="activity-section" open>
      <summary>
        <span><strong>Histórico de mandato</strong><small>Registros oficiais de exercício parlamentar</small></span>
        <span className="section-count">{history.length || '—'}</span>
      </summary>
      <div className="activity-body">
        <div className="mandate-summary">
          <div><span>Primeira legislatura localizada</span><strong>{legislatureLabel(chamber.primeira_legislatura)}</strong></div>
          <div><span>Última legislatura localizada</span><strong>{legislatureLabel(chamber.ultima_legislatura)}</strong></div>
        </div>
        {history.length ? (
          <div className="record-list">
            {history.slice().reverse().slice(0, 12).map((item, index) => (
              <div className="record-row" key={`${item.idLegislatura || ''}-${item.data || index}`}>
                <div>
                  <strong>{item.idLegislatura ? legislatureLabel(item.idLegislatura) : 'Registro de exercício'}</strong>
                  <small>{[item.siglaPartido, item.siglaUf, item.situacao].filter(Boolean).join(' · ') || 'Dados publicados pela Câmara'}</small>
                </div>
                <span>{formatDate(item.data)}</span>
              </div>
            ))}
          </div>
        ) : <EmptyBlock>Os detalhes do histórico ainda não foram publicados na carga local.</EmptyBlock>}
        <SourceLink href={profile?.mandato?.fonte_url || chamber.uri}>Fonte oficial na Câmara</SourceLink>
      </div>
    </details>
  );
}

function ExpensesSection({ data }) {
  const source = data?.fonte_url || data?.fonte_urls?.filter(Boolean)?.slice(-1)?.[0];
  return (
    <details className="activity-section">
      <summary>
        <span><strong>Despesas do mandato</strong><small>Cota para o exercício da atividade parlamentar · {periodLabel(data)}</small></span>
        <span className="section-count">{data?.quantidade_registros ?? '—'}</span>
      </summary>
      <div className="activity-body">
        {!data ? <EmptyBlock>Aguardando a primeira carga detalhada da Câmara.</EmptyBlock> : (
          <>
            <div className="metric-strip">
              <div><span>Valor líquido no período</span><strong>{formatMoney(data.valor_liquido_total)}</strong></div>
              <div><span>Registros no período</span><strong>{Number(data.quantidade_registros || 0).toLocaleString('pt-BR')}</strong></div>
            </div>
            <AnnualBreakdown items={data.por_ano} valueKey="valor_liquido_total" money label="Despesas por ano" />
            {data.registros_recentes?.length ? (
              <div className="record-list">
                {data.registros_recentes.slice(0, 12).map((item, index) => (
                  <div className="record-row expense-row" key={`${item.numero_documento || ''}-${index}`}>
                    <div>
                      <strong>{item.tipo_despesa || 'Despesa parlamentar'}</strong>
                      <small>{item.fornecedor || 'Fornecedor não informado'}{item.ano ? ` · ${item.ano}` : ''}{item.cnpj_cpf_fornecedor ? ` · ${item.cnpj_cpf_fornecedor}` : ''}</small>
                    </div>
                    <span>{formatMoney(item.valor_liquido ?? item.valor_documento)}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyBlock>Nenhum registro foi retornado para o período consultado.</EmptyBlock>}
            <p className="chart-scope-note">A lista de detalhes mantém uma amostra recente do período selecionado para reduzir o peso do perfil; os totais são calculados sobre todos os registros retornados pela fonte.</p>
            <SourceLink href={source}>Fonte oficial das despesas</SourceLink>
          </>
        )}
      </div>
    </details>
  );
}

function PropositionsSection({ data }) {
  return (
    <details className="activity-section">
      <summary>
        <span><strong>Proposições</strong><small>Autoria publicada pela Câmara · {periodLabel(data)}</small></span>
        <span className="section-count">{data?.quantidade_registros ?? '—'}</span>
      </summary>
      <div className="activity-body">
        {!data ? <EmptyBlock>Aguardando a primeira carga detalhada da Câmara.</EmptyBlock> : (
          <>
            <AnnualBreakdown items={data.por_ano} label="Proposições por ano" />
            {data.registros_recentes?.length ? (
              <div className="record-list">
                {data.registros_recentes.slice(0, 12).map((item, index) => (
                  <div className="record-row text-row" key={`${item.id || 'prop'}-${index}`}>
                    <div>
                      <strong>{[item.sigla_tipo, item.numero, item.ano].filter((v) => v !== null && v !== undefined).join(' ')}</strong>
                      <small>{item.ementa || 'Ementa não retornada na carga.'}</small>
                    </div>
                    <SourceLink href={item.uri}>Abrir</SourceLink>
                  </div>
                ))}
              </div>
            ) : <EmptyBlock>Nenhuma proposição foi retornada para o período consultado.</EmptyBlock>}
          </>
        )}
        {data?.nota_metodologica && <p className="method-note">{data.nota_metodologica}</p>}
        <SourceLink href={data?.fonte_url}>Consulta oficial de proposições</SourceLink>
      </div>
    </details>
  );
}

function VotesSection({ data }) {
  const source = data?.fonte_url || data?.fonte_urls?.filter(Boolean)?.slice(-1)?.[0];
  return (
    <details className="activity-section">
      <summary>
        <span><strong>Votações</strong><small>Votos/posicionamentos individuais registrados · {periodLabel(data)}</small></span>
        <span className="section-count">{data?.quantidade_registros ?? '—'}</span>
      </summary>
      <div className="activity-body">
        {!data ? <EmptyBlock>Aguardando a primeira carga detalhada da Câmara.</EmptyBlock> : (
          <>
            <AnnualBreakdown items={data.por_ano} label="Registros de votação por ano" />
            {data.registros_recentes?.length ? (
              <>
                <VoteDistributionChart data={data} />
                <div className="record-list">
                  {data.registros_recentes.slice(0, 15).map((item, index) => (
                    <div className="record-row vote-row" key={`${item.id_votacao}-${index}`}>
                      <div>
                        <strong>{item.descricao || `Votação ${item.id_votacao || ''}`}</strong>
                        <small>{[item.sigla_orgao, formatDate(item.data_hora_voto || item.data)].filter(Boolean).join(' · ')}</small>
                      </div>
                      <span className="vote-value">{item.voto || '—'}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <EmptyBlock>Nenhum voto individual foi retornado para o período consultado.</EmptyBlock>}
          </>
        )}
        {data?.nota_metodologica && <p className="method-note">{data.nota_metodologica}</p>}
        <SourceLink href={source}>Arquivo oficial de votos</SourceLink>
      </div>
    </details>
  );
}

export function ChamberActivity({ candidate, identity }) {
  const chamberId = identity?.camara_id_deputado?.[0];
  const [profile, setProfile] = useState(null);
  const [state, setState] = useState(chamberId ? 'loading' : 'idle');
  const [selectedYear, setSelectedYear] = useState('all');

  useEffect(() => {
    let active = true;
    if (!chamberId) return undefined;
    setState('loading');
    setSelectedYear('all');
    fetch(`/data/camara/perfis/${chamberId}.json`, { cache: 'no-cache' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (!active) return;
        setProfile(payload);
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        setProfile(null);
        setState('waiting');
      });
    return () => { active = false; };
  }, [chamberId]);

  const photo = useMemo(() => {
    const detail = profile?.mandato?.detalhe;
    return detail?.ultimoStatus?.urlFoto || detail?.urlFoto || chamberBasePhoto(candidate);
  }, [profile, candidate]);

  const years = useMemo(() => {
    const configured = profile?.periodo?.anos;
    if (Array.isArray(configured) && configured.length) return [...configured].sort((a, b) => a - b);
    return Object.keys(profile?.anos || {}).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  }, [profile]);

  const profilePeriod = profile?.periodo?.inicio && profile?.periodo?.fim
    ? `${profile.periodo.inicio}–${profile.periodo.fim}`
    : '2023–2026';
  const displayedPeriod = selectedYear === 'all' ? profilePeriod : selectedYear;

  const expensesData = useMemo(() => sectionForPeriod(profile, 'despesas', selectedYear), [profile, selectedYear]);
  const propositionsData = useMemo(() => sectionForPeriod(profile, 'proposicoes', selectedYear), [profile, selectedYear]);
  const votesData = useMemo(() => sectionForPeriod(profile, 'votacoes', selectedYear), [profile, selectedYear]);

  return (
    <section className="chamber-module" data-photo={photo || undefined}>
      <div className="chamber-module-heading">
        <div>
          <span className="module-kicker">O QUE ELE FEZ?</span>
          <h3>Histórico na Câmara localizado</h3>
          <p>Vínculo confirmado por coincidência exata e única de nome civil e data de nascimento nas fontes oficiais.</p>
          <span className="activity-period-badge">Atividade parlamentar exibida: {displayedPeriod}</span>
        </div>
        <div className="source-id"><span>ID Câmara</span><strong>{chamberId}</strong></div>
      </div>

      {state === 'loading' && <div className="activity-loading">Carregando atividade parlamentar publicada…</div>}
      {state === 'waiting' && <div className="activity-loading">Histórico básico disponível. Despesas, proposições e votações entrarão após a próxima coleta automática.</div>}

      {state === 'ready' && (
        <YearSelector years={years} selected={selectedYear} onChange={setSelectedYear} />
      )}

      <div className="activity-sections">
        <MandateSection identity={identity} profile={profile} candidate={candidate} />
        <ExpensesSection data={expensesData} />
        <PropositionsSection data={propositionsData} />
        <VotesSection data={votesData} />
        <details className="activity-section methodology-section">
          <summary><span><strong>Fontes e metodologia</strong><small>Como os dados foram vinculados e apresentados</small></span></summary>
          <div className="activity-body">
            <p className="method-note">O projeto não atribui nota, ranking ou juízo político. Ausência de registro significa apenas que a informação não foi localizada/publicada na fonte consultada para o período exibido.</p>
            <p className="method-note">Os totais de 2023–2026 são calculados ano a ano a partir das fontes oficiais. A opção “4 anos” consolida o período; os botões anuais permitem inspecionar cada ano separadamente sem baixar outro perfil.</p>
            <p className="method-note">Para manter o site leve, cada ano conserva apenas uma amostra dos registros detalhados mais recentes, sem reduzir os totais anuais.</p>
            <p className="method-note">A seção de proposições reproduz a autoria publicada pela Câmara. A seção de votações preserva o voto/posicionamento registrado sem interpretar seu mérito.</p>
            <SourceLink href={identity?.camara?.uri}>Cadastro oficial do parlamentar</SourceLink>
          </div>
        </details>
      </div>
    </section>
  );
}
