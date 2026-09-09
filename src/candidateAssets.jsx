import React, { useEffect, useMemo, useState } from 'react';
import './candidateAssets.css';

const TSE_2026_URL = 'https://dadosabertos.tse.jus.br/dataset/candidatos-2026';
const TSE_2022_URL = 'https://dadosabertos.tse.jus.br/dataset/candidatos-2022';

function shardKey(candidateId) {
  try {
    return (BigInt(String(candidateId || '0')) % 256n).toString(16).padStart(2, '0');
  } catch {
    return [...String(candidateId || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0).toString(16).slice(-2).padStart(2, '0');
  }
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function updatedAt(value) {
  if (!value) return 'data da carga não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date);
}

function declarationContext(year) {
  if (Number(year) === 2026) return 'Candidatura atual — Eleições 2026';
  return `Declaração histórica localizada — Eleições ${year}`;
}

async function optionalJson(url, signal) {
  try {
    const response = await fetch(url, { cache: 'no-cache', signal });
    return response.ok ? await response.json() : null;
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return null;
  }
}

export default function CandidateAssets({ candidate }) {
  const [record, setRecord] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();
    const id = String(candidate?.id_tse || '').trim();
    setRecord(null);
    setManifest(null);
    if (!id) {
      setStatus('empty');
      return () => controller.abort();
    }

    setStatus('loading');
    Promise.all([
      optionalJson(`/data/patrimonio-2026/shards/${shardKey(id)}.json`, controller.signal),
      optionalJson('/data/patrimonio-2026/manifest.json', controller.signal),
    ]).then(([shard, meta]) => {
      setManifest(meta);
      const found = shard?.[id] || null;
      setRecord(found);
      setStatus(found ? 'ready' : 'empty');
    }).catch((error) => {
      if (error.name !== 'AbortError') setStatus('error');
    });
    return () => controller.abort();
  }, [candidate?.id_tse]);

  const composition = useMemo(() => Array.isArray(record?.bens_por_tipo) ? record.bens_por_tipo : [], [record]);
  const assets = useMemo(() => Array.isArray(record?.bens) ? record.bens : [], [record]);
  const history = useMemo(() => {
    const items = Array.isArray(record?.historico) ? record.historico : [];
    return [...items].sort((a, b) => Number(a.ano || 0) - Number(b.ano || 0));
  }, [record]);
  const total = Number(record?.resumo?.total_declarado || 0);
  const maxComposition = Math.max(1, ...composition.map((item) => Number(item.valor || 0)));

  if (status === 'loading') {
    return <div className="assets-loading" aria-label="Carregando patrimônio"><span/><span/><span/><p>Consultando a carga patrimonial desta candidatura…</p></div>;
  }

  if (status === 'error') {
    return (
      <div className="assets-state">
        <strong>Não foi possível consultar os dados patrimoniais agora.</strong>
        <p>A candidatura continua disponível normalmente; esta camada pode ser consultada novamente mais tarde.</p>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <section className="assets-shell">
        <div className="assets-state neutral">
          <strong>Nenhum registro de bem foi localizado para esta candidatura na carga processada.</strong>
          <p>Isso descreve apenas o resultado da consulta ao arquivo oficial disponível e não deve ser interpretado, isoladamente, como ausência de patrimônio.</p>
          <a href={TSE_2026_URL} target="_blank" rel="noreferrer">Bens de candidatos — TSE ↗</a>
        </div>
      </section>
    );
  }

  return (
    <section className="assets-shell" aria-labelledby="assets-title">
      <div className="assets-heading">
        <div><span>PATRIMÔNIO DECLARADO</span><h3 id="assets-title">Bens informados à Justiça Eleitoral</h3></div>
        <small>Carga: {updatedAt(record.generated_at_utc || manifest?.generated_at_utc)}</small>
      </div>

      <div className="assets-summary">
        <article><span>Total declarado em 2026</span><strong>{money(total)}</strong><small>Valor nominal informado no conjunto oficial.</small></article>
        <article><span>Registros de bens</span><strong>{Number(record?.resumo?.quantidade_bens || assets.length).toLocaleString('pt-BR')}</strong><small>Itens encontrados para esta candidatura.</small></article>
      </div>

      <div className="assets-grid">
        <section className="assets-card">
          <div className="assets-card-heading"><h4>Composição por tipo de bem</h4><p>Categorias preservadas conforme a classificação publicada pelo TSE.</p></div>
          <div className="assets-bars">
            {composition.map((item) => (
              <div className="assets-bar-row" key={item.categoria}>
                <div><span>{item.categoria}</span><strong>{money(item.valor)}</strong></div>
                <div className="assets-track" aria-hidden="true"><span style={{ width: `${Math.max(1, Number(item.valor || 0) / maxComposition * 100)}%` }}/></div>
              </div>
            ))}
          </div>
        </section>

        <section className="assets-card">
          <div className="assets-card-heading"><h4>Declarações patrimoniais por eleição</h4><p>Valores oficiais exibidos cronologicamente quando o vínculo de identidade entre eleições é confirmado pelo método conservador do projeto.</p></div>
          {history.length > 1 ? (
            <div className="assets-declarations" aria-label="Histórico de declarações patrimoniais">
              {history.map((item) => (
                <article className="assets-declaration" key={item.ano}>
                  <div>
                    <span>{item.ano}</span>
                    <small>{declarationContext(item.ano)}</small>
                  </div>
                  <strong>{money(item.total_declarado)}</strong>
                </article>
              ))}
              <p className="assets-declarations-note">Cada valor corresponde à declaração daquela eleição, em reais nominais. A interface não calcula índice, score ou conclusão sobre mudança patrimonial.</p>
            </div>
          ) : (
            <div className="assets-history-empty"><strong>Declaração histórica anterior não confirmada.</strong><p>O projeto não exibe associação histórica baseada apenas em semelhança de nome.</p></div>
          )}
        </section>
      </div>

      <section className="assets-card assets-list-card">
        <div className="assets-card-heading"><h4>Bens declarados em 2026</h4><p>Descrições potencialmente identificadoras são reduzidas antes da publicação nesta interface.</p></div>
        <div className="assets-list">
          {assets.map((asset, index) => (
            <article key={`${asset.categoria}-${index}`}>
              <div><span>{asset.categoria}</span><p>{asset.descricao}</p>{asset.descricao_reduzida && <small>Descrição reduzida por privacidade.</small>}</div>
              <strong>{money(asset.valor)}</strong>
            </article>
          ))}
        </div>
      </section>

      <details className="assets-method">
        <summary>Fonte, privacidade e vínculo histórico</summary>
        <p><strong>2026:</strong> arquivo “Bens de candidatos”, Portal de Dados Abertos do TSE. Os valores são reproduzidos como valores nominais declarados e não representam avaliação de mercado.</p>
        <p><strong>Privacidade:</strong> a plataforma reduz descrições quando encontra padrões de endereço, conta/agência, documentos, telefone, CEP, placas, matrículas ou outros identificadores extensos. A categoria e o valor permanecem preservados.</p>
        <p><strong>Histórico:</strong> 2022 só é associado quando nome civil, data de nascimento e gênero formam uma assinatura exata e única nas duas eleições. A existência de uma declaração anterior confirma uma candidatura naquele pleito, mas não é usada pela plataforma, isoladamente, para afirmar exercício de mandato.</p>
        <p><strong>Leitura:</strong> os valores são apresentados por eleição e sem correção monetária. A plataforma não infere renda, valorização de mercado, origem de recursos ou qualquer irregularidade a partir das declarações.</p>
        <div><a href={TSE_2026_URL} target="_blank" rel="noreferrer">Fonte 2026 — TSE ↗</a><a href={TSE_2022_URL} target="_blank" rel="noreferrer">Fonte histórica 2022 — TSE ↗</a><a href="/metodologia">Metodologia do projeto</a></div>
      </details>
    </section>
  );
}
