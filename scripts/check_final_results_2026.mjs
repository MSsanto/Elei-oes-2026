import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ELECTION_2026, ELECTORATE_BY_UF } from '../src/election2026Facts.js';

const root = path.resolve('data/processed');
const read = async (relative) => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
const snapshot = await read('resultados-2026/status-por-candidato.json');
if (snapshot.fonte !== 'TSE - Resultados oficiais 2026') throw new Error('Snapshot sem fonte oficial TSE.');
const expected = { presidente: 1, governador: 27, senador: 54, 'deputado-federal': 513, 'deputado-estadual': 1059 };
const winners = Object.entries(snapshot.candidaturas).filter(([, record]) => record.situacao === 'eleito');
const counts = Object.fromEntries(Object.keys(expected).map((cargo) => [cargo, winners.filter(([, value]) => value.cargo === cargo).length]));
for (const [cargo, count] of Object.entries(expected)) {
  if (counts[cargo] !== count) throw new Error(`Vagas/eleitos inconsistentes para ${cargo}: ${counts[cargo]} (esperado ${count}).`);
}
if (winners.length !== 1654) throw new Error('Total de eleitas e eleitos diferente de 1.654.');
if (snapshot.cobertura?.arquivos_confirmados < 116) throw new Error('Cobertura oficial insuficiente.');
const secondRound = snapshot.cobertura.arquivos.filter((item) => [6258, 6260].includes(item.eleicao));
const secondRoundScopes = new Set(secondRound.map((item) => `${item.eleicao}:${item.uf}`));
for (const scope of ['6258:BR','6260:AC','6260:AM','6260:DF','6260:ES','6260:RN','6260:TO']) {
  if (!secondRoundScopes.has(scope)) throw new Error(`Totalização de 2º turno ausente: ${scope}`);
}
if (ELECTORATE_BY_UF.length !== 27) throw new Error('Eleitorado não contempla as 27 UFs.');
const electorate = ELECTORATE_BY_UF.reduce((sum, item) => sum + item.electorate, 0);
if (electorate !== ELECTION_2026.electorateInStates ||
    electorate + ELECTION_2026.electorateAbroad !== ELECTION_2026.electorateTotal) {
  throw new Error('Eleitorado por UF e exterior não concilia com o total TSE.');
}
if (ELECTORATE_BY_UF.reduce((sum, item) => sum + item.federalSeats, 0) !== 513) {
  throw new Error('Distribuição de cadeiras federais inconsistente.');
}

const candidates = new Map();
const add = (items, cargo) => {
  if (!Array.isArray(items)) throw new Error(`Base inválida para ${cargo}`);
  for (const item of items) {
    const id = String(item.id_tse || '');
    if (!id) continue;
    const key = `${cargo}:${item.uf || 'BR'}:${id}`;
    candidates.set(key, item);
  }
};
add(await read('candidatos/presidente/brasil.json'), 'presidente');
add(await read('deputados_federais.json'), 'deputado-federal');
for (const { uf } of ELECTORATE_BY_UF) {
  add(await read(`candidatos/governador/${uf}.json`), 'governador');
  add(await read(`candidatos/senador/${uf}.json`), 'senador');
  add(await read(`candidatos/deputado-estadual/${uf}/search-index.json`), 'deputado-estadual');
}
const unmatched = winners.filter(([id, record]) => !candidates.has(`${record.cargo}:${record.uf}:${id}`));
if (unmatched.length) {
  throw new Error(`${unmatched.length} eleitas/eleitos sem candidatura correspondente: ${unmatched.slice(0, 8).map(([id, record]) => `${record.cargo}/${record.uf}/${id}`).join(', ')}`);
}
console.log(`OK: ${winners.length} eleitas/eleitos ligados por SQ_CANDIDATO, 116+ arquivos oficiais, 7 escopos de 2º turno, 27 UFs e eleitorado conciliado.`);
