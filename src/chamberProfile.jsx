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

function SourceLink({ href, children }) {
  if (!href) return null;
  return <a className="source-link" href={href} target="_blank" rel="noreferrer">{children} ↗</a>;
}

function EmptyBlock({ children }) {
  return <p className="activity-empty">{children}</p>;
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
  return (
    <details className="activity-section">
      <summary>
        <span><strong>Despesas do mandato</strong><small>Cota para o exercício da atividade parlamentar · {data?.ano || 2026}</small></span>
        <span className="section-count">{data?.quantidade_registros ?? '—'}</span>
      </summary>
      <div className="activity-body">
        {!data ? <EmptyBlock>Aguardando a primeira carga detalhada da Câmara.</EmptyBlock> : (
          <>
            <div className="metric-strip">
              <div><span>Valor líquido publicado no período</span><strong>{formatMoney(data.valor_liquido_total)}</strong></div>
              <div><span>Registros publicados</span><strong>{Number(data.quantidade_registros || 0).toLocaleString('pt-BR')}</strong></div>
            </div>
            {data.registros_recentes?.length ? (
              <div className="record-list">
                {data.registros_recentes.slice(0, 12).map((item, index) => (
                  <div className="record-row expense-row" key={`${item.numero_documento || ''}-${index}`}>
                    <div>
                      <strong>{item.tipo_despesa || 'Despesa parlamentar'}</strong>
                      <small>{item.fornecedor || 'Fornecedor não informado'}{item.cnpj_cpf_fornecedor ? ` · ${item.cnpj_cpf_fornecedor}` : ''}</small>
                    </div>
                    <span>{formatMoney(item.valor_liquido ?? item.valor_documento)}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyBlock>Nenhum registro foi retornado para o período consultado.</EmptyBlock>}
            <SourceLink href={data.fonte_url}>Fonte oficial das despesas</SourceLink>
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
        <span><strong>Proposições</strong><small>Autoria publicada pela Câmara · {data?.ano || 2026}</small></span>
        <span className="section-count">{data?.quantidade_registros ?? '—'}</span>
      </summary>
      <div className="activity-body">
        {!data ? <EmptyBlock>Aguardando a primeira carga detalhada da Câmara.</EmptyBlock> : data.registros_recentes?.length ? (
          <div className="record-list">
            {data.registros_recentes.slice(0, 12).map((item) => (
              <div className="record-row text-row" key={item.id}>
                <div>
                  <strong>{[item.sigla_tipo, item.numero, item.ano].filter((v) => v !== null && v !== undefined).join(' ')}</strong>
                  <small>{item.ementa || 'Ementa não retornada na carga.'}</small>
                </div>
                <SourceLink href={item.uri}>Abrir</SourceLink>
              </div>
            ))}
          </div>
        ) : <EmptyBlock>Nenhuma proposição foi retornada para o período consultado.</EmptyBlock>}
        {data?.nota_metodologica && <p className="method-note">{data.nota_metodologica}</p>}
        <SourceLink href={data?.fonte_url}>Consulta oficial de proposições</SourceLink>
      </div>
    </details>
  );
}

function VotesSection({ data }) {
  return (
    <details className="activity-section">
      <summary>
        <span><strong>Votações</strong><small>Votos/posicionamentos individuais registrados · {data?.ano || 2026}</small></span>
        <span className="section-count">{data?.quantidade_registros ?? '—'}</span>
      </summary>
      <div className="activity-body">
        {!data ? <EmptyBlock>Aguardando a primeira carga detalhada da Câmara.</EmptyBlock> : data.registros_recentes?.length ? (
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
        ) : <EmptyBlock>Nenhum voto individual foi retornado para o período consultado.</EmptyBlock>}
        {data?.nota_metodologica && <p className="method-note">{data.nota_metodologica}</p>}
        <SourceLink href={data?.fonte_url}>Arquivo oficial de votos</SourceLink>
      </div>
    </details>
  );
}

export function ChamberActivity({ candidate, identity }) {
  const chamberId = identity?.camara_id_deputado?.[0];
  const [profile, setProfile] = useState(null);
  const [state, setState] = useState(chamberId ? 'loading' : 'idle');

  useEffect(() => {
    let active = true;
    if (!chamberId) return undefined;
    setState('loading');
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

  return (
    <section className="chamber-module" data-photo={photo || undefined}>
      <div className="chamber-module-heading">
        <div>
          <span className="module-kicker">O QUE ELE FEZ?</span>
          <h3>Histórico na Câmara localizado</h3>
          <p>Vínculo confirmado por coincidência exata e única de nome civil e data de nascimento nas fontes oficiais.</p>
        </div>
        <div className="source-id"><span>ID Câmara</span><strong>{chamberId}</strong></div>
      </div>

      {state === 'loading' && <div className="activity-loading">Carregando atividade parlamentar publicada…</div>}
      {state === 'waiting' && <div className="activity-loading">Histórico básico disponível. Despesas, proposições e votações entrarão após a próxima coleta automática.</div>}

      <div className="activity-sections">
        <MandateSection identity={identity} profile={profile} candidate={candidate} />
        <ExpensesSection data={profile?.despesas} />
        <PropositionsSection data={profile?.proposicoes} />
        <VotesSection data={profile?.votacoes} />
        <details className="activity-section methodology-section">
          <summary><span><strong>Fontes e metodologia</strong><small>Como os dados foram vinculados e apresentados</small></span></summary>
          <div className="activity-body">
            <p className="method-note">O projeto não atribui nota, ranking ou juízo político. Ausência de registro significa apenas que a informação não foi localizada/publicada na fonte consultada para o período exibido.</p>
            <p className="method-note">A seção de proposições reproduz a autoria publicada pela Câmara. A seção de votações preserva o voto/posicionamento registrado sem interpretar seu mérito.</p>
            <SourceLink href={identity?.camara?.uri}>Cadastro oficial do parlamentar</SourceLink>
          </div>
        </details>
      </div>
    </section>
  );
}
