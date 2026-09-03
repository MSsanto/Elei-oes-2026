import puppeteer from '@cloudflare/puppeteer';

const WORKER_REVISION = 'tse-historico-ddd-v5';
const DATASET_URL_2026 = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026';
const DATASET_URL_2022 = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2022';
const DIVULGACAND_URL = 'https://divulgacandcontas.tse.jus.br/divulga/#/';
const DIVULGACAND_API_BASE = '/divulga/rest/v1';
const DIVULGACAND_TEST = {
  ano: 2026,
  uf: 'AC',
  sqCandidato: '10002545667',
};

const DATASETS = {
  candidatos: {
    portal: DATASET_URL_2026,
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip',
    pattern: '*consulta_cand_2026.zip*',
    filename: 'consulta_cand_2026.zip',
  },
  complementar: {
    portal: DATASET_URL_2026,
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand_complementar/consulta_cand_complementar_2026.zip',
    pattern: '*consulta_cand_complementar_2026.zip*',
    filename: 'consulta_cand_complementar_2026.zip',
  },
  candidatos2022: {
    portal: DATASET_URL_2022,
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2022.zip',
    pattern: '*consulta_cand_2022.zip*',
    filename: 'consulta_cand_2022.zip',
  },
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
const RELEVANT_FIELD_TOKENS = [
  'domic',
  'municip',
  'zona',
  'eleitor',
  'titulo',
  'local',
  'endereco',
  'ue',
];

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('');
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

function selectedDataset(url) {
  const key = url.searchParams.get('dataset') || 'candidatos';
  return { key, dataset: DATASETS[key] || null };
}

function authorized(request, env) {
  const expected = String(env.DOWNLOAD_TOKEN || '');
  if (!expected) return false;
  const header = request.headers.get('Authorization') || '';
  return header === `Bearer ${expected}`;
}

function collectKeyPaths(value, prefix = '', out = new Set(), depth = 0) {
  if (depth > 8 || out.size >= 600 || value === null || value === undefined) return out;

  if (Array.isArray(value)) {
    value.slice(0, 3).forEach((item) => collectKeyPaths(item, prefix ? `${prefix}[]` : '[]', out, depth + 1));
    return out;
  }

  if (typeof value !== 'object') return out;

  for (const [key, child] of Object.entries(value)) {
    if (out.size >= 600) break;
    const path = prefix ? `${prefix}.${key}` : key;
    out.add(path);
    collectKeyPaths(child, path, out, depth + 1);
  }
  return out;
}

function relevantFieldPaths(paths) {
  return paths.filter((path) => {
    const normalized = path.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return RELEVANT_FIELD_TOKENS.some((token) => normalized.includes(token));
  });
}

async function openTseDataset(page, portalUrl) {
  await page.setUserAgent(USER_AGENT);
  const portalResponse = await page.goto(portalUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  return portalResponse?.status() ?? null;
}

async function captureZip(env, dataset) {
  let browser;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    const portalStatus = await openTseDataset(page, dataset.portal || DATASET_URL_2026);
    if (portalStatus === null || portalStatus >= 400) {
      throw new Error(`Portal do TSE retornou status ${portalStatus}`);
    }

    const cdp = await page.createCDPSession();
    await cdp.send('Fetch.enable', {
      patterns: [{ urlPattern: dataset.pattern, requestStage: 'Response' }],
    });

    let resolveCapture;
    const capturePromise = new Promise((resolve) => { resolveCapture = resolve; });

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
        responseHeaders,
        bytes,
        bodyError,
      });
    };

    cdp.on('Fetch.requestPaused', onPaused);

    let navigationError = null;
    try {
      await page.goto(dataset.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (error) {
      navigationError = safeError(error);
    }

    const captured = await Promise.race([capturePromise, sleep(20000).then(() => null)]);
    cdp.off('Fetch.requestPaused', onPaused);
    await cdp.send('Fetch.disable').catch(() => undefined);

    if (!captured) throw new Error('A resposta HTTP do ZIP nao foi interceptada pelo CDP.');
    if (!captured.bytes) throw new Error(captured.bodyError || 'O corpo do ZIP nao foi capturado.');
    if (captured.status !== 200) throw new Error(`TSE retornou HTTP ${captured.status}.`);

    const signature = Array.from(captured.bytes.slice(0, 4));
    if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
      throw new Error(`Resposta sem assinatura ZIP: ${signature.join(',')}`);
    }

    const digest = await crypto.subtle.digest('SHA-256', captured.bytes);
    return {
      ...captured,
      navigationError,
      sha256: toHex(digest),
    };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

async function probeTse(env) {
  const startedAt = Date.now();
  const result = {
    ok: false,
    tested_at_utc: new Date().toISOString(),
    dataset_url: DATASET_URL_2026,
    resources: {},
  };

  // O probe regular permanece leve e valida apenas os dois recursos usados na rotina de 2026.
  for (const key of ['candidatos', 'complementar']) {
    const dataset = DATASETS[key];
    try {
      const captured = await captureZip(env, dataset);
      result.resources[key] = {
        url: dataset.url,
        status: captured.status,
        content_type: captured.responseHeaders?.['content-type'] || null,
        captured_bytes: captured.bytes.byteLength,
        zip_magic_ok: true,
        sha256: captured.sha256,
        navigation_error: captured.navigationError,
      };
    } catch (error) {
      result.resources[key] = { url: dataset.url, error: safeError(error) };
    }
  }

  result.ok = Object.values(result.resources).every((item) => item.status === 200 && item.zip_magic_ok === true);
  result.elapsed_ms = Date.now() - startedAt;
  return result;
}

async function testZipBodyCapture(env, datasetKey = 'candidatos') {
  const dataset = DATASETS[datasetKey];
  if (!dataset) return { ok: false, error: 'Dataset invalido.' };
  const startedAt = Date.now();
  try {
    const captured = await captureZip(env, dataset);
    return {
      ok: true,
      tested_at_utc: new Date().toISOString(),
      dataset: datasetKey,
      expected_zip_url: dataset.url,
      strategy: 'Chrome DevTools Protocol Fetch interception',
      capture: {
        url: captured.url,
        status: captured.status,
        content_type: captured.responseHeaders?.['content-type'] || null,
        declared_content_length: captured.responseHeaders?.['content-length'] || null,
        captured_bytes: captured.bytes.byteLength,
        first_four_bytes: Array.from(captured.bytes.slice(0, 4)),
        zip_magic_ok: true,
        sha256: captured.sha256,
        navigation_error: captured.navigationError,
        body_error: captured.bodyError,
      },
      elapsed_ms: Date.now() - startedAt,
    };
  } catch (error) {
    return { ok: false, error: safeError(error), elapsed_ms: Date.now() - startedAt };
  }
}

async function downloadResponse(env, key, dataset) {
  try {
    const captured = await captureZip(env, dataset);
    return new Response(captured.bytes, {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${dataset.filename}"`,
        'cache-control': 'no-store',
        'x-tse-dataset': key,
        'x-tse-sha256': captured.sha256,
        'x-worker-revision': WORKER_REVISION,
      },
    });
  } catch (error) {
    return json({ error: safeError(error), dataset: key, worker_revision: WORKER_REVISION }, 502);
  }
}

async function inspectDivulgaCandFields(env) {
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

    const raw = await page.evaluate(async ({ apiBase, test }) => {
      async function getJson(path) {
        const response = await fetch(path, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
        const text = await response.text();
        let body = null;
        try {
          body = JSON.parse(text);
        } catch {
          body = null;
        }
        return { status: response.status, body };
      }

      const elections = await getJson(`${apiBase}/eleicao/ordinarias`);
      const election = Array.isArray(elections.body)
        ? elections.body.find((item) => Number(item?.ano) === Number(test.ano))
        : null;
      const electionId = election?.id ?? null;

      let candidate = { status: null, body: null };
      if (electionId !== null) {
        candidate = await getJson(
          `${apiBase}/candidatura/buscar/${test.ano}/${test.uf}/${electionId}/candidato/${test.sqCandidato}`,
        );
      }

      return {
        electionsStatus: elections.status,
        electionId,
        candidateStatus: candidate.status,
        candidateBody: candidate.body,
      };
    }, { apiBase: DIVULGACAND_API_BASE, test: DIVULGACAND_TEST });

    const candidateBody = raw.candidateBody;
    const paths = candidateBody && typeof candidateBody === 'object'
      ? [...collectKeyPaths(candidateBody)].sort()
      : [];
    const topLevelKeys = candidateBody && !Array.isArray(candidateBody) && typeof candidateBody === 'object'
      ? Object.keys(candidateBody).sort()
      : [];

    return {
      ok: raw.candidateStatus === 200 && paths.length > 0,
      tested_at_utc: new Date().toISOString(),
      worker_revision: WORKER_REVISION,
      source: 'DivulgaCandContas / TSE',
      test_reference: {
        ano: DIVULGACAND_TEST.ano,
        uf: DIVULGACAND_TEST.uf,
        sq_candidato: DIVULGACAND_TEST.sqCandidato,
        election_id: raw.electionId,
      },
      http: {
        portal_status: portalStatus,
        elections_status: raw.electionsStatus,
        candidate_detail_status: raw.candidateStatus,
      },
      field_inventory: {
        top_level_keys: topLevelKeys,
        relevant_paths: relevantFieldPaths(paths),
        total_unique_paths: paths.length,
      },
      privacy: {
        values_returned: false,
        note: 'O diagnostico retorna somente nomes de campos e status HTTP; valores do candidato nao sao expostos.',
      },
      elapsed_ms: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      tested_at_utc: new Date().toISOString(),
      worker_revision: WORKER_REVISION,
      error: safeError(error),
      elapsed_ms: Date.now() - startedAt,
    };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({
        service: 'eleicoes-2026-tse-browser-probe',
        status: 'ready',
        worker_revision: WORKER_REVISION,
        probe: '/probe',
        download_test: '/download-test?dataset=candidatos|complementar|candidatos2022',
        download: '/download?dataset=candidatos|complementar|candidatos2022',
        download_complementar: '/download-complementar',
        inspect_divulgacand_fields: '/inspect-divulgacand-fields',
        supported_datasets: Object.keys(DATASETS),
        protected_endpoints_auth: 'Bearer token required',
      });
    }

    if (url.pathname === '/probe') {
      const result = await probeTse(env);
      return json(result, result.ok ? 200 : 502);
    }

    if (url.pathname === '/download-test') {
      const { key, dataset } = selectedDataset(url);
      if (!dataset) return json({ error: 'Dataset invalido', allowed: Object.keys(DATASETS) }, 400);
      const result = await testZipBodyCapture(env, key);
      return json(result, result.ok ? 200 : 502);
    }

    if (url.pathname === '/download-complementar') {
      if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401);
      return downloadResponse(env, 'complementar', DATASETS.complementar);
    }

    if (url.pathname === '/download') {
      if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401);
      const { key, dataset } = selectedDataset(url);
      if (!dataset) return json({ error: 'Dataset invalido', allowed: Object.keys(DATASETS) }, 400);
      return downloadResponse(env, key, dataset);
    }

    if (url.pathname === '/inspect-divulgacand-fields') {
      if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401);
      const result = await inspectDivulgaCandFields(env);
      return json(result, result.ok ? 200 : 502);
    }

    return json({ error: 'Not found', worker_revision: WORKER_REVISION }, 404);
  },
};
