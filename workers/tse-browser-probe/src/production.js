import puppeteer from '@cloudflare/puppeteer';
import probeWorker from './index.js';

const PRODUCTION_REVISION = 'dataset-router-v3-finance';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
        payload.download = '/download?dataset=candidatos|prestacaoCandidatos2026|complementar|candidatos2022';
        payload.download_auth = 'Authorization: Bearer <DOWNLOAD_TOKEN>';
        return json(payload, response.status);
      } catch {
        return response;
      }
    }

    return response;
  },
};
