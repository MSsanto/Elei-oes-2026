import puppeteer from '@cloudflare/puppeteer';
import productionWorker from './production.js';

const RUNTIME_REVISION = 'dataset-router-v8-zero-copy-finance-stream';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
const FINANCE_DATASET_KEY = 'prestacaoCandidatos2026';
const FINANCE_DATASET = {
  portal: 'https://dadosabertos.tse.jus.br/pt_BR/dataset/prestacao-de-contas-eleitorais-2026',
  url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2026.zip',
  filename: 'prestacao_de_contas_eleitorais_candidatos_2026.zip',
  pattern: '*prestacao_de_contas_eleitorais_candidatos_2026.zip*',
  minBytes: 10_000,
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-production-revision': RUNTIME_REVISION,
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

async function browserLimits(endpoint) {
  try {
    const limits = await puppeteer.limits(endpoint);
    return {
      activeSessions: Array.isArray(limits?.activeSessions) ? limits.activeSessions.length : null,
      allowedBrowserAcquisitions: Number(limits?.allowedBrowserAcquisitions ?? 0),
      maxConcurrentSessions: Number(limits?.maxConcurrentSessions ?? 0),
      timeUntilNextAllowedBrowserAcquisition: Number(limits?.timeUntilNextAllowedBrowserAcquisition ?? 0),
    };
  } catch (error) {
    return { error: safeError(error) };
  }
}

function acquisitionWaitMs(limits, fallbackMs = 20_500) {
  let raw = Number(limits?.timeUntilNextAllowedBrowserAcquisition || 0);
  if (raw > 0 && raw < 1000) raw *= 1000;
  if (raw <= 0) raw = fallbackMs;
  return Math.max(1_500, Math.min(raw + 500, 22_000));
}

async function connectFreeSession(endpoint) {
  let sessions = [];
  try {
    sessions = await puppeteer.sessions(endpoint);
  } catch {
    return null;
  }

  const freeSessions = sessions
    .filter((session) => session?.sessionId && !session.connectionId)
    .sort((left, right) => Number(left.startTime || 0) - Number(right.startTime || 0));

  for (const session of freeSessions) {
    try {
      const browser = await puppeteer.connect(endpoint, session.sessionId);
      return {
        browser,
        sessionId: session.sessionId,
        reused: true,
      };
    } catch {
      // Outra invocacao pode ter conectado entre sessions() e connect().
    }
  }
  return null;
}

async function acquireBrowser(endpoint) {
  let lastError = null;
  let lastLimits = await browserLimits(endpoint);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const reused = await connectFreeSession(endpoint);
    if (reused) {
      return { ...reused, limits: lastLimits, acquisitionAttempt: attempt };
    }

    lastLimits = await browserLimits(endpoint);
    const allowed = Number(lastLimits?.allowedBrowserAcquisitions ?? 0);
    const active = Number(lastLimits?.activeSessions ?? 0);
    const maximum = Number(lastLimits?.maxConcurrentSessions ?? 0);

    if (allowed <= 0 || (maximum > 0 && active >= maximum)) {
      if (attempt < 3) {
        await sleep(acquisitionWaitMs(lastLimits, active >= maximum ? 5_000 : 20_500));
        continue;
      }
      break;
    }

    try {
      const browser = await puppeteer.launch(endpoint, { keep_alive: 90_000 });
      return {
        browser,
        sessionId: browser.sessionId(),
        reused: false,
        limits: lastLimits,
        acquisitionAttempt: attempt,
      };
    } catch (error) {
      lastError = error;
      if (!/429|rate limit/i.test(safeError(error))) throw error;
      lastLimits = await browserLimits(endpoint);
      if (attempt < 3) {
        await sleep(acquisitionWaitMs(lastLimits));
      }
    }
  }

  throw new Error(
    `Browser Run indisponivel apos espera/reuso: ${safeError(lastError || 'limite de aquisicao')}; `
    + `limits=${JSON.stringify(lastLimits)}`,
  );
}

async function captureViaEdgeFetch(dataset) {
  const response = await fetch(dataset.url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      Accept: 'application/zip,application/octet-stream;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'identity',
      Referer: dataset.portal,
      'User-Agent': USER_AGENT,
      'Cache-Control': 'no-cache',
    },
  });

  if (response.status !== 200 || !response.body) {
    const detail = (await response.text().catch(() => '')).slice(0, 500);
    throw new Error(`Cloudflare edge fetch retornou HTTP ${response.status}: ${detail}`);
  }

  return {
    body: response.body,
    sourceUrl: response.url || dataset.url,
    contentType: response.headers.get('content-type') || 'application/zip',
    contentLength: response.headers.get('content-length') || '',
    transport: 'cloudflare_edge_fetch_stream',
    session: null,
  };
}

async function captureViaBrowser(env, dataset, ctx) {
  const acquisition = await acquireBrowser(env.BROWSER);
  const browser = acquisition.browser;
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);

  const portalResponse = await page.goto(dataset.portal, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  const portalStatus = portalResponse?.status() ?? null;
  if (portalStatus === null || portalStatus >= 400) {
    await page.close().catch(() => undefined);
    browser.disconnect();
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
  let rejectCapture;
  const capturePromise = new Promise((resolve, reject) => {
    resolveCapture = resolve;
    rejectCapture = reject;
  });

  const cleanup = async () => {
    cdp.off('Fetch.requestPaused', onPaused);
    await cdp.send('Fetch.disable').catch(() => undefined);
    await page.close().catch(() => undefined);
    browser.disconnect();
  };

  const onPaused = async (event) => {
    const requestUrl = event?.request?.url || '';
    if (!requestUrl.includes(dataset.filename)) {
      await cdp.send('Fetch.continueRequest', { requestId: event.requestId }).catch(() => undefined);
      return;
    }

    const responseHeaders = headersToObject(event.responseHeaders || []);
    const status = event.responseStatusCode ?? null;
    if (status !== 200) {
      await cdp.send('Fetch.continueRequest', { requestId: event.requestId }).catch(() => undefined);
      await cleanup();
      rejectCapture(new Error(`TSE retornou HTTP ${status} no navegador.`));
      return;
    }

    let streamHandle;
    try {
      const bodyStream = await cdp.send('Fetch.takeResponseBodyAsStream', {
        requestId: event.requestId,
      });
      streamHandle = bodyStream.stream;
    } catch (error) {
      await cleanup();
      rejectCapture(new Error(`Nao foi possivel abrir o stream do ZIP: ${safeError(error)}`));
      return;
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const pump = async () => {
      let totalBytes = 0;
      let signatureChecked = false;
      try {
        while (true) {
          const part = await cdp.send('IO.read', {
            handle: streamHandle,
            size: 512 * 1024,
          });
          const chunk = part.base64Encoded
            ? base64ToBytes(part.data || '')
            : new TextEncoder().encode(part.data || '');

          if (chunk.byteLength > 0) {
            if (!signatureChecked) {
              if (chunk.byteLength < 2 || chunk[0] !== 0x50 || chunk[1] !== 0x4b) {
                throw new Error('Resposta recebida nao possui assinatura ZIP.');
              }
              signatureChecked = true;
            }
            totalBytes += chunk.byteLength;
            await writer.write(chunk);
          }

          if (part.eof) break;
        }

        if (!signatureChecked || totalBytes <= dataset.minBytes) {
          throw new Error(`ZIP recebido e pequeno demais: ${totalBytes} bytes`);
        }
        await writer.close();
      } catch (error) {
        await writer.abort(error).catch(() => undefined);
      } finally {
        await cdp.send('IO.close', { handle: streamHandle }).catch(() => undefined);
        await cdp.send('Fetch.failRequest', {
          requestId: event.requestId,
          errorReason: 'Aborted',
        }).catch(() => undefined);
        await cleanup();
      }
    };

    const streamTask = pump();
    if (ctx?.waitUntil) ctx.waitUntil(streamTask);

    resolveCapture({
      body: readable,
      sourceUrl: requestUrl,
      contentType: responseHeaders['content-type'] || 'application/zip',
      contentLength: responseHeaders['content-length'] || '',
      transport: acquisition.reused ? 'cloudflare_browser_reused_session_stream' : 'cloudflare_browser_new_session_stream',
      session: {
        id: acquisition.sessionId,
        reused: acquisition.reused,
        acquisition_attempt: acquisition.acquisitionAttempt,
      },
    });
  };

  cdp.on('Fetch.requestPaused', onPaused);

  page.goto(zipUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => undefined);

  const captured = await Promise.race([
    capturePromise,
    sleep(60000).then(() => null),
  ]);

  if (!captured) {
    await cleanup();
    throw new Error('A resposta do ZIP nao foi interceptada pelo CDP.');
  }
  return captured;
}

async function downloadFinance(request, env, ctx) {
  const authorizationError = authorize(request, env);
  if (authorizationError) return authorizationError;

  let edgeError = null;
  let captured;
  try {
    captured = await captureViaEdgeFetch(FINANCE_DATASET);
  } catch (error) {
    edgeError = safeError(error);
    try {
      captured = await captureViaBrowser(env, FINANCE_DATASET, ctx);
    } catch (browserError) {
      const limits = await browserLimits(env.BROWSER);
      return json({
        error: safeError(browserError),
        edge_fetch_error: edgeError,
        browser_limits: limits,
        source: FINANCE_DATASET.url,
        dataset: FINANCE_DATASET_KEY,
        production_revision: RUNTIME_REVISION,
      }, 502);
    }
  }

  const headers = {
    'content-type': captured.contentType,
    'content-disposition': `attachment; filename="${FINANCE_DATASET.filename}"`,
    'cache-control': 'no-store',
    'x-tse-source': captured.sourceUrl,
    'x-tse-dataset': FINANCE_DATASET_KEY,
    'x-tse-transport': captured.transport,
    'x-production-revision': RUNTIME_REVISION,
    ...(captured.session?.reused !== undefined
      ? { 'x-browser-session-reused': String(captured.session.reused) }
      : {}),
  };
  if (captured.contentLength) headers['content-length'] = captured.contentLength;

  return new Response(captured.body, {
    status: 200,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/download' && url.searchParams.get('dataset') === FINANCE_DATASET_KEY) {
      return downloadFinance(request, env, ctx);
    }

    const response = await productionWorker.fetch(request, env, ctx);
    if (url.pathname === '/' || url.pathname === '/health') {
      try {
        const payload = await response.clone().json();
        payload.runtime_revision = RUNTIME_REVISION;
        payload.finance_transport = 'edge streaming -> reusable Browser Run streaming session';
        payload.finance_validation = 'assinatura/tamanho no Worker; SHA-256 e integridade ZIP no coletor Python';
        return json(payload, response.status);
      } catch {
        return response;
      }
    }
    return response;
  },
};
