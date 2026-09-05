import puppeteer from '@cloudflare/puppeteer';
import probeWorker from './index.js';

const PRODUCTION_REVISION = 'dataset-router-v5-candidate-statuses';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
const DIVULGACAND_URL = 'https://divulgacandcontas.tse.jus.br/divulga/#/';
const DIVULGACAND_API_BASE = '/divulga/rest/v1';
const STATUS_YEAR = 2026;
const STATUS_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
const STATUS_QUERY_PLAN = [
  ['BR', '1', 'Presidente'],
  ...STATUS_UFS.map((uf) => [uf, '3', 'Governador']),
  ...STATUS_UFS.map((uf) => [uf, '5', 'Senador']),
  ...STATUS_UFS.map((uf) => [uf, '6', 'Deputado Federal']),
  ...STATUS_UFS.filter((uf) => uf !== 'DF').map((uf) => [uf, '7', 'Deputado Estadual']),
  ['DF', '8', 'Deputado Distrital'],
];

const DATASETS = {
  candidatos: {
    portal: 'https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip',
    filename: 'consulta_cand_2026.zip',
    pattern: '*consulta_cand_2026.zip*',
    minBytes: 1_000_000,
  },
  prestacaoCandidatos2026: {
    portal: 'https://dadosabertos.tse.jus.br/pt_BR/dataset/prestacao-de-contas-eleitorais-2026',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2026.zip',
    filename: 'prestacao_de_contas_eleitorais_candidatos_2026.zip',
    pattern: '*prestacao_de_contas_eleitorais_candidatos_2026.zip*',
    minBytes: 10_000,
  },
  bens2026: {
    portal: 'https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2026.zip',
    filename: 'bem_candidato_2026.zip',
    pattern: '*bem_candidato_2026.zip*',
    minBytes: 10_000,
  },
  bens2022: {
    portal: 'https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2022',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2022.zip',
    filename: 'bem_candidato_2022.zip',
    pattern: '*bem_candidato_2022.zip*',
    minBytes: 10_000,
  },
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function compactJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-production-revision': PRODUCTION_REVISION,
    },
  });
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function headersToObject(headers = []) {
  return Object.fromEntries(headers.map((header) => [String(header.name).toLowerCase(), header.value]));
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function captureOfficialZip(env, dataset) {
  let browser;

  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    const portalResponse = await page.goto(dataset.portal, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const portalStatus = portalResponse?.status() ?? null;
    if (portalStatus === null || portalStatus >= 400) {
      throw new Error(`Portal do TSE retornou status ${portalStatus}`);
    }

    const discoveredZip = await page
      .$$eval(`a[href*="${dataset.filename}"]`, (links) => links.map((link) => link.href).find(Boolean) || null)
      .catch(() => null);
    const zipUrl = discoveredZip || dataset.url;

    const cdp = await page.createCDPSession();
    await cdp.send('Fetch.enable', {
      patterns: [{ urlPattern: dataset.pattern, requestStage: 'Response' }],
    });

    let resolveCapture;
    const capturePromise = new Promise((resolve) => {
      resolveCapture = resolve;
    });

    const onPaused = async (event) => {
      const requestUrl = event?.request?.url || '';
      if (!requestUrl.includes(dataset.filename)) {
        await cdp.send('Fetch.continueRequest', { requestId: event.requestId }).catch(() => undefined);
        return;
      }

      const responseHeaders = headersToObject(event.responseHeaders || []);
      let bytes = null;
      let bodyError = null;

      try {
        const body = await cdp.send('Fetch.getResponseBody', { requestId: event.requestId });
        bytes = body.base64Encoded ? base64ToBytes(body.body) : new TextEncoder().encode(body.body);
      } catch (error) {
        bodyError = safeError(error);
      }

      await cdp.send('Fetch.continueRequest', { requestId: event.requestId }).catch(() => undefined);
      resolveCapture({
        url: requestUrl,
        status: event.responseStatusCode ?? null,
        headers: responseHeaders,
        bytes,
        bodyError,
      });
    };

    cdp.on('Fetch.requestPaused', onPaused);

    try {
      await page.goto(zipUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch {
      // ZIPs podem encerrar a navegacao do Chromium com ERR_ABORTED.
    }

    const captured = await Promise.race([
      capturePromise,
      sleep(25000).then(() => null),
    ]);

    cdp.off('Fetch.requestPaused', onPaused);
    await cdp.send('Fetch.disable').catch(() => undefined);

    if (!captured) {
      throw new Error('A resposta do ZIP nao foi interceptada pelo CDP.');
    }
    if (!captured.bytes) {
      throw new Error(`O corpo do ZIP nao pode ser lido: ${captured.bodyError || 'erro desconhecido'}`);
    }

    const signature = Array.from(captured.bytes.slice(0, 4));
    const zipMagic = signature[0] === 0x50 && signature[1] === 0x4b;
    if (captured.status !== 200 || !zipMagic || captured.bytes.byteLength <= dataset.minBytes) {
      throw new Error(`Resposta invalida do TSE: status=${captured.status}, bytes=${captured.bytes.byteLength}`);
    }

    const digest = await crypto.subtle.digest('SHA-256', captured.bytes);
    return {
      bytes: captured.bytes,
      sha256: toHex(digest),
      sourceUrl: captured.url,
      contentType: captured.headers?.['content-type'] || 'application/zip',
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

function authorize(request, env) {
  const expected = String(env.DOWNLOAD_TOKEN || '');
  if (!expected) {
    return json({ error: 'DOWNLOAD_TOKEN nao configurado no Worker.' }, 503);
  }

  const provided = request.headers.get('authorization') || '';
  if (provided !== `Bearer ${expected}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  return null;
}

async function downloadDataset(request, env, key, dataset) {
  const authorizationError = authorize(request, env);
  if (authorizationError) return authorizationError;

  try {
    const captured = await captureOfficialZip(env, dataset);
    return new Response(captured.bytes, {
      status: 200,
      headers: {
        'content-type': captured.contentType,
        'content-disposition': `attachment; filename="${dataset.filename}"`,
        'content-length': String(captured.bytes.byteLength),
        'cache-control': 'no-store',
        'x-tse-source': captured.sourceUrl,
        'x-tse-sha256': captured.sha256,
        'x-tse-dataset': key,
        'x-production-revision': PRODUCTION_REVISION,
      },
    });
  } catch (error) {
    return json({ error: safeError(error), source: dataset.url, dataset: key, production_revision: PRODUCTION_REVISION }, 502);
  }
}

async function collectCandidateStatuses(request, env) {
  const authorizationError = authorize(request, env);
  if (authorizationError) return authorizationError;

  let browser;
  const startedAt = Date.now();
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    const portalResponse = await page.goto(DIVULGACAND_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    const portalStatus = portalResponse?.status() ?? null;
    if (portalStatus === null || portalStatus >= 400) {
      throw new Error(`DivulgaCand retornou status ${portalStatus}`);
    }

    const collectedAt = new Date().toISOString();
    const result = await page.evaluate(async ({ apiBase, year, plan }) => {
      async function getJson(path) {
        const response = await fetch(path, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
        const bodyText = await response.text();
        let body = null;
        try {
          body = JSON.parse(bodyText);
        } catch {
          body = null;
        }
        return { status: response.status, body };
      }

      function findElection(value) {
        if (Array.isArray(value)) {
          for (const child of value) {
            const found = findElection(child);
            if (found) return found;
          }
          return null;
        }
        if (!value || typeof value !== 'object') return null;
        const itemYear = Number(value.ano ?? value.anoEleicao ?? value.nrAno ?? 0);
        const turn = String(value.turno ?? value.nrTurno ?? '1');
        if (itemYear === Number(year) && turn === '1') return value;
        for (const child of Object.values(value)) {
          const found = findElection(child);
          if (found) return found;
        }
        return null;
      }

      function readable(value) {
        const text = String(value ?? '').trim();
        return text && !text.startsWith('#') ? text : '';
      }

      function minimalCandidate(item) {
        const id = String(item?.id ?? item?.sq_CANDIDATO ?? item?.sqCandidato ?? item?.SQ_CANDIDATO ?? '').trim();
        const status = readable(
          item?.descricaoSituacao
          ?? item?.situacaoCandidato
          ?? item?.descricaoSituacaoCandidato
          ?? item?.DS_SITUACAO_CANDIDATURA,
        );
        if (!/^\d+$/.test(id) || !status) return null;
        const detail = readable(item?.descricaoSituacaoCandidato);
        return {
          id,
          descricaoSituacao: status,
          descricaoSituacaoCandidato: detail && detail.toLocaleLowerCase('pt-BR') !== status.toLocaleLowerCase('pt-BR') ? detail : '',
          codigoSituacao: String(item?.codigoSituacao ?? item?.codigoSituacaoCandidato ?? item?.CD_SITUACAO_CANDIDATURA ?? '').trim(),
          dataUltimaAtualizacao: String(item?.dataUltimaAtualizacao ?? item?.dt_ULTIMA_ATUALIZACAO ?? item?.DT_GERACAO ?? '').trim(),
        };
      }

      const elections = await getJson(`${apiBase}/eleicao/ordinarias`);
      if (elections.status !== 200) {
        return { ok: false, stage: 'elections', status: elections.status, failures: [], records: [] };
      }
      const election = findElection(elections.body);
      const electionId = election?.id ?? election?.idEleicao ?? election?.sqEleicao ?? election?.sq_ELEICAO ?? null;
      if (electionId === null || electionId === undefined || electionId === '') {
        return { ok: false, stage: 'election-id', status: elections.status, failures: [], records: [] };
      }

      const records = [];
      const failures = [];
      let succeeded = 0;
      const batchSize = 10;
      for (let offset = 0; offset < plan.length; offset += batchSize) {
        const batch = plan.slice(offset, offset + batchSize);
        const responses = await Promise.all(batch.map(async ([unit, cargoCode, cargoLabel]) => {
          const endpoint = `${apiBase}/candidatura/listar/${year}/${unit}/${electionId}/${cargoCode}/candidatos`;
          const response = await getJson(endpoint);
          return { unit, cargoCode, cargoLabel, endpoint, ...response };
        }));

        for (const response of responses) {
          if (response.status !== 200) {
            failures.push({
              unidade: response.unit,
              cargo_codigo: response.cargoCode,
              cargo: response.cargoLabel,
              http_status: response.status,
            });
            continue;
          }
          const raw = Array.isArray(response.body)
            ? response.body
            : (Array.isArray(response.body?.candidatos)
              ? response.body.candidatos
              : (Array.isArray(response.body?.candidates) ? response.body.candidates : null));
          if (!raw) {
            failures.push({
              unidade: response.unit,
              cargo_codigo: response.cargoCode,
              cargo: response.cargoLabel,
              http_status: response.status,
              erro: 'payload_sem_lista_de_candidatos',
            });
            continue;
          }
          succeeded += 1;
          for (const item of raw) {
            const candidate = minimalCandidate(item);
            if (candidate) records.push(candidate);
          }
        }
        if (offset + batchSize < plan.length) {
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
      }

      return {
        ok: failures.length === 0 && succeeded === plan.length,
        electionId,
        queriesExpected: plan.length,
        queriesSucceeded: succeeded,
        failures,
        records,
      };
    }, { apiBase: DIVULGACAND_API_BASE, year: STATUS_YEAR, plan: STATUS_QUERY_PLAN });

    if (!result.ok) {
      return compactJson({
        ok: false,
        source: 'DivulgaCandContas — Tribunal Superior Eleitoral (TSE)',
        collected_at_utc: collectedAt,
        election_id: result.electionId ?? null,
        queries_expected: result.queriesExpected ?? STATUS_QUERY_PLAN.length,
        queries_succeeded: result.queriesSucceeded ?? 0,
        queries_failed: Array.isArray(result.failures) ? result.failures.length : STATUS_QUERY_PLAN.length,
        failures: result.failures || [],
        elapsed_ms: Date.now() - startedAt,
      }, 502);
    }

    return compactJson({
      ok: true,
      source: 'DivulgaCandContas — Tribunal Superior Eleitoral (TSE)',
      source_url: 'https://divulgacandcontas.tse.jus.br/divulga/',
      collected_at_utc: collectedAt,
      election_id: result.electionId,
      queries_expected: result.queriesExpected,
      queries_succeeded: result.queriesSucceeded,
      queries_failed: 0,
      failures: [],
      records: result.records,
      elapsed_ms: Date.now() - startedAt,
      production_revision: PRODUCTION_REVISION,
    });
  } catch (error) {
    return compactJson({
      ok: false,
      source: 'DivulgaCandContas — Tribunal Superior Eleitoral (TSE)',
      error: safeError(error),
      queries_expected: STATUS_QUERY_PLAN.length,
      queries_succeeded: 0,
      queries_failed: STATUS_QUERY_PLAN.length,
      failures: [],
      elapsed_ms: Date.now() - startedAt,
      production_revision: PRODUCTION_REVISION,
    }, 502);
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/candidate-statuses') {
      return collectCandidateStatuses(request, env);
    }

    if (url.pathname === '/download') {
      const datasetKey = url.searchParams.get('dataset') || 'candidatos';
      const dataset = DATASETS[datasetKey];
      if (dataset) {
        return downloadDataset(request, env, datasetKey, dataset);
      }
      // Recursos complementares/historicos continuam na camada multidataset existente.
      return probeWorker.fetch(request, env);
    }

    const response = await probeWorker.fetch(request, env);
    if (url.pathname === '/' || url.pathname === '/health') {
      try {
        const payload = await response.clone().json();
        payload.production_revision = PRODUCTION_REVISION;
        payload.production_datasets = Object.keys(DATASETS);
        payload.download = '/download?dataset=candidatos|prestacaoCandidatos2026|bens2026|bens2022|complementar|candidatos2022';
        payload.download_auth = 'Authorization: Bearer <DOWNLOAD_TOKEN>';
        payload.candidate_statuses = '/candidate-statuses';
        payload.candidate_statuses_auth = 'Authorization: Bearer <DOWNLOAD_TOKEN>';
        payload.candidate_status_queries = STATUS_QUERY_PLAN.length;
        return json(payload, response.status);
      } catch {
        return response;
      }
    }

    return response;
  },
};