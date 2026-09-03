import puppeteer from '@cloudflare/puppeteer';

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

async function probeTse(env) {
  const startedAt = Date.now();
  let browser;

  const result = {
    ok: false,
    tested_at_utc: new Date().toISOString(),
    dataset_url: DATASET_URL,
    expected_zip_url: ZIP_URL,
    portal: null,
    resource: null,
    notes: [
      'Este endpoint apenas testa acesso. Ele nao altera a base publicada.',
      'Cloudflare Browser Run identifica suas sessoes automatizadas como bot; o objetivo e medir o comportamento real do TSE nessa infraestrutura.',
    ],
  };

  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    const portalResponse = await page.goto(DATASET_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const portalStatus = portalResponse?.status() ?? null;
    const portalTitle = await page.title().catch(() => '');
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '').catch(() => '');

    result.portal = {
      status: portalStatus,
      title: portalTitle,
      accessible: portalStatus !== null && portalStatus < 400,
      body_preview: bodyText,
    };

    const discoveredZip = await page
      .$$eval('a[href*="consulta_cand_2026.zip"]', (links) => links.map((link) => link.href).find(Boolean) || null)
      .catch(() => null);

    const zipUrl = discoveredZip || ZIP_URL;
    let observedResponse = null;

    const onResponse = (response) => {
      const url = response.url();
      if (!url.includes('consulta_cand_2026.zip')) return;
      observedResponse = {
        url,
        status: response.status(),
        content_type: response.headers()?.['content-type'] || null,
        content_length: response.headers()?.['content-length'] || null,
      };
    };

    page.on('response', onResponse);

    let navigationError = null;
    try {
      const zipNavigation = await page.goto(zipUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      if (zipNavigation && !observedResponse) {
        observedResponse = {
          url: zipNavigation.url(),
          status: zipNavigation.status(),
          content_type: zipNavigation.headers()?.['content-type'] || null,
          content_length: zipNavigation.headers()?.['content-length'] || null,
        };
      }
    } catch (error) {
      navigationError = safeError(error);
      // Downloads binarios podem abortar a navegacao do Chromium mesmo quando
      // a resposta HTTP foi aceita. O listener de 'response' acima preserva
      // o status observado nesses casos.
      await new Promise((resolve) => setTimeout(resolve, 1200));
    } finally {
      page.off('response', onResponse);
    }

    let responseBodyPreview = '';
    if (observedResponse?.status && observedResponse.status >= 400) {
      responseBodyPreview = await page
        .evaluate(() => document.body?.innerText?.slice(0, 500) || '')
        .catch(() => '');
    }

    result.resource = {
      discovered_in_portal: Boolean(discoveredZip),
      url: zipUrl,
      response: observedResponse,
      navigation_error: navigationError,
      body_preview: responseBodyPreview,
      accepted_by_tse: observedResponse?.status === 200,
    };

    result.ok = Boolean(result.portal?.accessible && result.resource?.accepted_by_tse);
    result.elapsed_ms = Date.now() - startedAt;
    return result;
  } catch (error) {
    result.error = safeError(error);
    result.elapsed_ms = Date.now() - startedAt;
    return result;
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({
        service: 'eleicoes-2026-tse-browser-probe',
        status: 'ready',
        probe: '/probe',
        purpose: 'Testar se o TSE aceita Cloudflare Browser Run antes de migrar a coleta automatica.',
      });
    }

    if (url.pathname === '/probe') {
      const result = await probeTse(env);
      return json(result, result.ok ? 200 : 502);
    }

    return json({ error: 'Not found', probe: '/probe' }, 404);
  },
};
