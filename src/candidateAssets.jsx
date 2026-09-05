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
  const history = useMemo(() => Array.isArray(record?.historico) ? record.historico : [], [record]);
  const total = Number(record?.resumo?.total_declarado || 0);
  const maxComposition = Math.max(1, ...composition.map((item) => Number(item.valor || 0)));
  const maxHistory = Math.max(1, ...history.map((item) => Number(item.total_declarado || 0)));

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
          <div className="assets-card-heading"><h4>Histórico nominal de declarações</h4><p>Exibido somente quando a identidade entre eleições atende ao critério conservador do projeto.</p></div>
          {history.length > 1 ? (
            <div className="assets-history">
              {history.map((item) => (
                <div className="assets-history-row" key={item.ano}>
                  <span>{item.ano}</span>
                  <div className="assets-history-track" aria-hidden="true"><i style={{ width: `${Math.max(1, Number(item.total_declarado || 0) / maxHistory * 100)}%` }}/></div>
                  <strong>{money(item.total_declarado)}</strong>
                </div>
              ))}
              <small>Valores nominais de cada eleição, sem correção monetária e sem estimativa de preço atual de mercado.</small>
            </div>
          ) : (
            <div className="assets-history-empty"><strong>Histórico anterior não confirmado.</strong><p>O projeto não exibe associação histórica baseada apenas em semelhança de nome.</p></div>
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
        <p><strong>Histórico:</strong> 2022 só é associado quando nome civil, data de nascimento e gênero formam uma assinatura exata e única nas duas eleições. Ausência de vínculo significa apenas que o critério não foi satisfeito.</p>
        <div><a href={TSE_2026_URL} target="_blank" rel="noreferrer">Fonte 2026 — TSE ↗</a><a href={TSE_2022_URL} target="_blank" rel="noreferrer">Fonte histórica 2022 — TSE ↗</a><a href="/metodologia">Metodologia do projeto</a></div>
      </details>
    </section>
  );
}
