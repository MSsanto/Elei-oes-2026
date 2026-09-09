export const ELECTION_2026 = {
  electorateTotal: 158745463,
  electorateInStates: 157826587,
  electorateAbroad: 918876,
  electorateReferenceDate: '20/07/2026',
  federalDeputySeats: 513,
  senateSeats: 81,
  senateSeatsContested2026: 54,
  stateDeputySeats: 1035,
  districtDeputySeats: 24,
};

export const OFFICIAL_SOURCES = {
  electorate: 'https://www.tse.jus.br/comunicacao/noticias/2026/Julho/mais-de-158-milhoes-de-eleitores-estao-aptos-votar-nas-eleicoes-2026',
  electorateOpenData: 'https://dadosabertos.tse.jus.br/dataset/eleitorado-2026',
  candidatesOpenData: 'https://dadosabertos.tse.jus.br/dataset/candidatos-2026',
  federalSeats: 'https://www2.camara.leg.br/a-camara/conheca/numero-de-deputados-por-estado',
  federalSeats2026: 'https://www.camara.leg.br/comprove/1302885-e-falso-que-sao-531-vagas-de-deputados-federais-para-a-proxima-legislatura',
  senate2026: 'https://www12.senado.leg.br/noticias/materias/2026/07/14/eleitor-escolhera-dois-senadores-neste-ano-veja-como-votar',
  quotient: 'https://www.tse.jus.br/comunicacao/noticias/2026/Abril/por-dentro-das-eleicoes-brasil-utiliza-sistemas-eleitorais-majoritario-e-proporcional',
  blankNull: 'https://www.tse.jus.br/comunicacao/noticias/2026/Julho/voto-branco-x-voto-nulo-saiba-a-diferenca-de-acordo-com-o-glossario-eleitoral',
  eligibility: 'https://www.tse.jus.br/servicos-eleitorais/glossario/termos/elegibilidade',
};

export const ELECTORATE_BY_UF = [
  { uf: 'AC', name: 'Acre', electorate: 614375, federalSeats: 8 },
  { uf: 'AL', name: 'Alagoas', electorate: 2441794, federalSeats: 9 },
  { uf: 'AP', name: 'Amapá', electorate: 577534, federalSeats: 8 },
  { uf: 'AM', name: 'Amazonas', electorate: 2801182, federalSeats: 8 },
  { uf: 'BA', name: 'Bahia', electorate: 11321005, federalSeats: 39 },
  { uf: 'CE', name: 'Ceará', electorate: 6998494, federalSeats: 22 },
  { uf: 'DF', name: 'Distrito Federal', electorate: 2253132, federalSeats: 8 },
  { uf: 'ES', name: 'Espírito Santo', electorate: 2990490, federalSeats: 10 },
  { uf: 'GO', name: 'Goiás', electorate: 5080755, federalSeats: 17 },
  { uf: 'MA', name: 'Maranhão', electorate: 5186562, federalSeats: 18 },
  { uf: 'MT', name: 'Mato Grosso', electorate: 2638230, federalSeats: 8 },
  { uf: 'MS', name: 'Mato Grosso do Sul', electorate: 2024884, federalSeats: 8 },
  { uf: 'MG', name: 'Minas Gerais', electorate: 16377659, federalSeats: 53 },
  { uf: 'PA', name: 'Pará', electorate: 6265355, federalSeats: 17 },
  { uf: 'PB', name: 'Paraíba', electorate: 3247397, federalSeats: 12 },
  { uf: 'PR', name: 'Paraná', electorate: 8609026, federalSeats: 30 },
  { uf: 'PE', name: 'Pernambuco', electorate: 7225744, federalSeats: 25 },
  { uf: 'PI', name: 'Piauí', electorate: 2708160, federalSeats: 10 },
  { uf: 'RJ', name: 'Rio de Janeiro', electorate: 12857000, federalSeats: 46 },
  { uf: 'RN', name: 'Rio Grande do Norte', electorate: 2660565, federalSeats: 8 },
  { uf: 'RS', name: 'Rio Grande do Sul', electorate: 8526233, federalSeats: 31 },
  { uf: 'RO', name: 'Rondônia', electorate: 1267105, federalSeats: 8 },
  { uf: 'RR', name: 'Roraima', electorate: 401496, federalSeats: 8 },
  { uf: 'SC', name: 'Santa Catarina', electorate: 5725753, federalSeats: 16 },
  { uf: 'SP', name: 'São Paulo', electorate: 34104226, federalSeats: 70 },
  { uf: 'SE', name: 'Sergipe', electorate: 1740124, federalSeats: 8 },
  { uf: 'TO', name: 'Tocantins', electorate: 1182307, federalSeats: 8 },
];

export function findUfFacts(uf) {
  return ELECTORATE_BY_UF.find((item) => item.uf === String(uf || '').toUpperCase()) || null;
}

export function formatInteger(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

export function formatRatio(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}
