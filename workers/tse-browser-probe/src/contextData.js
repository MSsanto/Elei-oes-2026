import puppeteer from '@cloudflare/puppeteer';
import productionWorker from './production.js';

const REVISION = 'election-context-v1';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

const CONTEXT_DATASETS = {
  vagas2026: {
    portal: 'https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_vagas/consulta_vagas_2026.zip',
    filename: 'consulta_vagas_2026.zip',
    pattern: '*consulta_vagas_2026.zip*',
    minBytes: 1_000,
  },
  eleitorado2026: {
    portal: 'https://dadosabertos.tse.jus.br/pt_BR/dataset/eleitorado-2026',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitorado/perfil_eleitorado_2026.zip',
    filename: 'perfil_eleitorado_2026.zip',
    pattern: '*perfil_eleitorado_2026.zip*',
    minBytes: 10_000,
  },
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-context-revision': REVISION,
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
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function headersToObject(headers = []) {
  return Object.fromEntries(headers.map((header) => [String(header.name).toLowerCase(), header.value]));
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function authorized(request, env) {
  const expected = String(env.DOWNLOAD_TOKEN || '');
  if (!expected) return false;
  return (request.headers.get('authorization') || '') === `Bearer ${expected}`;
}

async function captureZip(env, dataset) {
  let browser;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    const portal = await page.goto(dataset.portal, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const portalStatus = portal?.status() ?? null;
    if (portalStatus === null || portalStatus >= 400) throw new Error(`Portal do TSE retornou status ${portalStatus}`);

    const discovered = await page
      .$$eval(`a[href*="${dataset.filename}"]`, (links) => links.map((link) => link.href).find(Boolean) || null)
      .catch(() => null);
    const targetUrl = discovered || dataset.url;

    const cdp = await page.createCDPSession();
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: dataset.pattern, requestStage: 'Response' }] });

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
      resolveCapture({ url: requestUrl, status: event.responseStatusCode ?? null, responseHeaders, bytes, bodyError });
    };

    cdp.on('Fetch.requestPaused', onPaused);
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch {
      // Downloads ZIP podem encerrar a navegação com ERR_ABORTED.
    }

    const captured = await Promise.race([capturePromise, sleep(25000).then(() => null)]);
    cdp.off('Fetch.requestPaused', onPaused);
    await cdp.send('Fetch.disable').catch(() => undefined);

    if (!captured) throw new Error('Resposta do ZIP não interceptada pelo CDP.');
    if (!captured.bytes) throw new Error(captured.bodyError || 'Corpo do ZIP indisponível.');
    if (captured.status !== 200) throw new Error(`TSE retornou HTTP ${captured.status}.`);
    if (captured.bytes.byteLength < dataset.minBytes) throw new Error(`ZIP menor que o mínimo esperado: ${captured.bytes.byteLength} bytes.`);
    if (captured.bytes[0] !== 0x50 || captured.bytes[1] !== 0x4b) throw new Error('Resposta sem assinatura ZIP.');

    const digest = await crypto.subtle.digest('SHA-256', captured.bytes);
    return { ...captured, sha256: toHex(digest) };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

async function downloadContextDataset(request, env, key, dataset) {
  if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401);
  try {
    const captured = await captureZip(env, dataset);
    return new Response(captured.bytes, {
      status: 200,
      headers: {
        'content-type': captured.responseHeaders?.['content-type'] || 'application/zip',
        'content-disposition': `attachment; filename="${dataset.filename}"`,
        'content-length': String(captured.bytes.byteLength),
        'cache-control': 'no-store',
        'x-tse-source': captured.url,
        'x-tse-sha256': captured.sha256,
        'x-tse-dataset': key,
        'x-context-revision': REVISION,
      },
    });
  } catch (error) {
    return json({ error: safeError(error), dataset: key, source: dataset.url }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/download') {
      const key = url.searchParams.get('dataset') || '';
      const dataset = CONTEXT_DATASETS[key];
      if (dataset) return downloadContextDataset(request, env, key, dataset);
    }

    const response = await productionWorker.fetch(request, env);
    if ((url.pathname === '/' || url.pathname === '/health') && response.headers.get('content-type')?.includes('application/json')) {
      try {
        const payload = await response.clone().json();
        payload.context_revision = REVISION;
        payload.context_datasets = Object.keys(CONTEXT_DATASETS);
        return json(payload, response.status);
      } catch {
        return response;
      }
    }
    return response;
  },
};
