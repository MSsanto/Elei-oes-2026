import puppeteer from '@cloudflare/puppeteer';
import probeWorker from './index.js';

const PRODUCTION_REVISION = 'dataset-router-v2';
const DATASET_URL = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026';
const ZIP_URL = 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

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

async function captureOfficialZip(env) {
  let browser;

  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    const portalResponse = await page.goto(DATASET_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const portalStatus = portalResponse?.status() ?? null;
    if (portalStatus === null || portalStatus >= 400) {
      throw new Error(`Portal do TSE retornou status ${portalStatus}`);
    }

    const discoveredZip = await page
      .$$eval('a[href*="consulta_cand_2026.zip"]', (links) => links.map((link) => link.href).find(Boolean) || null)
      .catch(() => null);
    const zipUrl = discoveredZip || ZIP_URL;

    const cdp = await page.createCDPSession();
    await cdp.send('Fetch.enable', {
      patterns: [{ urlPattern: '*consulta_cand_2026.zip*', requestStage: 'Response' }],
    });

    let resolveCapture;
    const capturePromise = new Promise((resolve) => {
      resolveCapture = resolve;
    });

    const onPaused = async (event) => {
      const requestUrl = event?.request?.url || '';
      if (!requestUrl.includes('consulta_cand_2026.zip')) {
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
      await page.goto(zipUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch {
      // ZIPs disparam download no Chromium e podem encerrar a navegacao com ERR_ABORTED.
    }

    const captured = await Promise.race([
      capturePromise,
      sleep(12000).then(() => null),
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
    if (captured.status !== 200 || !zipMagic || captured.bytes.byteLength <= 1000000) {
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

async function downloadCurrentCandidates(request, env) {
  const authorizationError = authorize(request, env);
  if (authorizationError) return authorizationError;

  try {
    const captured = await captureOfficialZip(env);
    return new Response(captured.bytes, {
      status: 200,
      headers: {
        'content-type': captured.contentType,
        'content-disposition': 'attachment; filename="consulta_cand_2026.zip"',
        'content-length': String(captured.bytes.byteLength),
        'cache-control': 'no-store',
        'x-tse-source': captured.sourceUrl,
        'x-tse-sha256': captured.sha256,
        'x-tse-dataset': 'candidatos',
        'x-production-revision': PRODUCTION_REVISION,
      },
    });
  } catch (error) {
    return json({ error: safeError(error), source: ZIP_URL, production_revision: PRODUCTION_REVISION }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/download') {
      const dataset = url.searchParams.get('dataset') || 'candidatos';
      if (dataset === 'candidatos') {
        return downloadCurrentCandidates(request, env);
      }
      // Recursos complementares/historicos sao tratados pela camada multidataset.
      return probeWorker.fetch(request, env);
    }

    const response = await probeWorker.fetch(request, env);
    if (url.pathname === '/' || url.pathname === '/health') {
      try {
        const payload = await response.clone().json();
        payload.production_revision = PRODUCTION_REVISION;
        payload.download = '/download?dataset=candidatos|complementar|candidatos2022';
        payload.download_auth = 'Authorization: Bearer <DOWNLOAD_TOKEN>';
        return json(payload, response.status);
      } catch {
        return response;
      }
    }

    return response;
  },
};
