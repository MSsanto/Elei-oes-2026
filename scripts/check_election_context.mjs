import {
  ELECTION_2026,
  ELECTORATE_BY_UF,
  stateLegislatureSeats,
} from '../src/election2026Facts.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(ELECTORATE_BY_UF.length === 27, 'Esperadas 27 unidades da Federação.');

const electorateInStates = ELECTORATE_BY_UF.reduce((sum, item) => sum + Number(item.electorate || 0), 0);
assert(
  electorateInStates === ELECTION_2026.electorateInStates,
  `Eleitorado das UFs diverge: ${electorateInStates} != ${ELECTION_2026.electorateInStates}`,
);
assert(
  ELECTION_2026.electorateInStates + ELECTION_2026.electorateAbroad === ELECTION_2026.electorateTotal,
  'Eleitorado nacional não fecha com UFs + exterior.',
);

const federalSeats = ELECTORATE_BY_UF.reduce((sum, item) => sum + Number(item.federalSeats || 0), 0);
assert(
  federalSeats === ELECTION_2026.federalDeputySeats,
  `Vagas federais divergem: ${federalSeats} != ${ELECTION_2026.federalDeputySeats}`,
);

const legislativeSeats = ELECTORATE_BY_UF.reduce(
  (sum, item) => sum + Number(stateLegislatureSeats(item.uf) || 0),
  0,
);
assert(
  legislativeSeats === ELECTION_2026.stateDeputySeats + ELECTION_2026.districtDeputySeats,
  `Vagas estaduais/distritais divergem: ${legislativeSeats}`,
);

assert(ELECTION_2026.senateSeatsContested2026 === 54, 'Em 2026 devem ser 54 vagas ao Senado.');
assert(ELECTION_2026.federalDeputySeats === 513, 'Em 2026 devem ser 513 vagas de Deputado Federal.');

console.log(
  `Contexto eleitoral consistente: 27 UFs, ${ELECTION_2026.electorateTotal.toLocaleString('pt-BR')} eleitores, ${federalSeats} vagas federais e ${legislativeSeats} vagas estaduais/distritais.`,
);
