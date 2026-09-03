const TSE_BASE = 'https://divulgacandcontas.tse.jus.br/divulga/rest/v1';
const VALID_UFS = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]);
const CARGO_DEPUTADO_FEDERAL = 6;
const KNOWN_2026_ELECTION_IDS = ['20322002026', '2062262026'];

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? 'public, max-age=300, s-maxage=900' : 'no-store',
      ...extraHeaders,
    },
  });
}

async function tseFetch(path) {
  const response = await fetch(`${TSE_BASE}${path}`, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'pt-BR,pt;q=0.9',
      referer: 'https://divulgacandcontas.tse.jus.br/',
      'user-agent': 'Eleicoes-2026-Transparencia/0.3 (+https://github.com/MSsanto/Elei-oes-2026)',
    },
    cf: { cacheTtl: 300, cacheEverything: true },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`TSE respondeu HTTP ${response.status}${text ? `: ${text.slice(0, 160)}` : ''}`);
  }
  return response.json();
}

function electionObjects(value, found = []) {
  if (!value) return found;
  if (Array.isArray(value)) {
    for (const item of value) electionObjects(item, found);
    return found;
  }
  if (typeof value !== 'object') return found;

  const year = Number(value.ano ?? value.anoEleicao ?? value.nrAno);
  if (year === 2026) found.push(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') electionObjects(child, found);
  }
  return found;
}

function getElectionId(item) {
  return item?.id ?? item?.idEleicao ?? item?.sqEleicao ?? item?.sq_ELEICAO ?? null;
}

async function discoverElectionIds() {
  const ids = [];
  try {
    const payload = await tseFetch('/eleicao/ordinarias');
    const discovered = electionObjects(payload)
      .map((item) => getElectionId(item))
      .filter((id) => id !== null && id !== undefined)
      .map(String);
    ids.push(...discovered);
  } catch (error) {
    console.warn('Descoberta automática da eleição falhou; tentando IDs conhecidos:', error);
  }

  ids.push(...KNOWN_2026_ELECTION_IDS);
  return [...new Set(ids)];
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? '';
}

function normalizeCandidate(candidate, uf, electionId) {
  const id = String(first(candidate.id, candidate.sq_CANDIDATO, candidate.sqCandidato));
  const partyObject = candidate.partido && typeof candidate.partido === 'object' ? candidate.partido : {};
  const photo = first(candidate.fotoUrl, candidate.urlFoto);

  return {
    ano_eleicao: '2026',
    uf,
    id_tse: id,
    numero: String(first(candidate.numero, candidate.nr_CANDIDATO, candidate.nrCandidato)),
    nome: String(first(candidate.nomeCompleto, candidate.nm_CANDIDATO, candidate.nome)),
    nome_urna: String(first(candidate.nomeUrna, candidate.nm_URNA, candidate.nmUrna)),
    partido: String(first(partyObject.sigla, candidate.sg_PARTIDO, candidate.siglaPartido)),
    numero_partido: String(first(partyObject.numero, candidate.nr_PARTIDO, candidate.numeroPartido)),
    situacao_candidatura: String(first(candidate.descricaoSituacao, candidate.situacaoCandidato, candidate.descricaoSituacaoCandidato)),
    situacao_urna: String(first(candidate.descricaoTotalizacao, candidate.situacaoTotalizacao)),
    genero: String(first(candidate.descricaoSexo, candidate.genero)),
    grau_instrucao: String(first(candidate.grauInstrucao, candidate.descricaoGrauInstrucao)),
    ocupacao: String(first(candidate.ocupacao, candidate.descricaoOcupacao)),
    cor_raca: String(first(candidate.descricaoCorRaca, candidate.corRaca)),
    data_nascimento: first(candidate.dataDeNascimento, candidate.dataNascimento),
    foto_url: photo ? String(photo) : (id ? `https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/${electionId}/${id}/${uf}` : ''),
  };
}

async function fetchCandidatesForElection(uf, electionId) {
  const payload = await tseFetch(`/candidatura/listar/2026/${uf}/${electionId}/${CARGO_DEPUTADO_FEDERAL}/candidatos`);
  const rawCandidates = Array.isArray(payload) ? payload : (payload.candidatos || payload.candidates || []);
  return rawCandidates
    .map((candidate) => normalizeCandidate(candidate, uf, electionId))
    .filter((candidate) => candidate.id_tse && (candidate.nome_urna || candidate.nome));
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const uf = (url.searchParams.get('uf') || 'SP').toUpperCase();
  const requestedLimit = Number(url.searchParams.get('limit') || '120');
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1500) : 120;

  if (!VALID_UFS.has(uf)) {
    return json({ error: 'UF inválida.' }, 400);
  }

  const attempts = [];
  try {
    const electionIds = await discoverElectionIds();

    for (const electionId of electionIds) {
      try {
        const candidates = await fetchCandidatesForElection(uf, electionId);
        if (!candidates.length) {
          attempts.push({ election_id: electionId, result: 'sem candidatos' });
          continue;
        }

        return json({
          source: 'TSE DivulgaCandContas',
          election_id: electionId,
          cargo: 'DEPUTADO FEDERAL',
          uf,
          records: Math.min(candidates.length, limit),
          generated_at_utc: new Date().toISOString(),
          candidates: candidates.slice(0, limit),
        });
      } catch (error) {
        attempts.push({ election_id: electionId, error: error instanceof Error ? error.message : String(error) });
      }
    }

    throw new Error('Nenhum dos identificadores de eleição testados retornou candidatos.');
  } catch (error) {
    console.error('Falha ao consultar TSE:', error, attempts);
    return json({
      error: 'Não foi possível consultar o TSE a partir deste ponto de presença da Cloudflare.',
      detail: error instanceof Error ? error.message : String(error),
      attempts,
      uf,
    }, 502);
  }
}
