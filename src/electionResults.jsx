import React from 'react';
import './electionResults.css';

export const RESULTS_URL = '/data/resultados-2026/status-por-candidato.json';
export const OFFICIAL_RESULTS_URL = 'https://resultados.tse.jus.br/';

export function resultForCandidate(candidate, snapshot) {
  if (!candidate?.id_tse || snapshot?.fonte !== 'TSE - Resultados oficiais 2026') return null;
  const record = snapshot.candidaturas?.[String(candidate.id_tse)];
  if (!record || !['eleito', 'nao_eleito'].includes(record.situacao)) return null;
  // Os códigos dos resultados eleitorais são ligados diretamente ao SQ_CANDIDATO.
  // Nunca inferir resultado pelo número, pelo nome ou pela situação do registro.
  if (record.cargo && candidate.cargo_slug && record.cargo !== candidate.cargo_slug) return null;
  if (record.uf && candidate.uf && record.uf !== candidate.uf) return null;
  return record;
}

export function resultLabel(candidate, snapshot) {
  const record = resultForCandidate(candidate, snapshot);
  if (!record) return 'Não confirmado';
  return record.situacao === 'eleito' ? 'Eleito' : 'Não eleito';
}

export function ElectionResultBadge({ candidate, snapshot }) {
  const record = resultForCandidate(candidate, snapshot);
  const label = resultLabel(candidate, snapshot);
  return (
    <span
      className={`election-result-badge election-result-badge--${record?.situacao || 'unknown'}`}
      title={record ? `Resultado eleitoral publicado pelo TSE: ${record.detalhe || label}. ${snapshot?.atualizado_em || ''}` : 'Sem resultado eleitoral confirmado na carga arquivada. Não significa que a candidatura não tenha sido eleita.'}
    >{label}</span>
  );
}

export async function fetchElectionResults(signal) {
  const response = await fetch(RESULTS_URL, { cache: 'no-cache', signal });
  if (!response.ok) return null;
  const body = await response.json();
  return body?.fonte === 'TSE - Resultados oficiais 2026' && body?.candidaturas && typeof body.candidaturas === 'object'
    ? body : null;
}
