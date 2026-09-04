import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const host = '127.0.0.1';
const port = 4173;
const base = `http://${host}:${port}`;
const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [viteBin, 'preview', '--host', host, '--port', String(port), '--strictPort'], {
  stdio: 'ignore',
  env: { ...process.env, NODE_ENV: 'production' },
});

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Preview encerrou antes de iniciar, código ${child.exitCode}.`);
    try {
      const response = await fetch(`${base}/`, { redirect: 'manual' });
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Preview não iniciou dentro da janela de validação.');
}

async function expectOk(pathname, description) {
  const response = await fetch(`${base}${pathname}`, { redirect: 'manual' });
  if (!response.ok) throw new Error(`${description}: HTTP ${response.status} em ${pathname}`);
  return response;
}

async function expectAppRoute(pathname) {
  const response = await expectOk(pathname, 'Rota da aplicação indisponível');
  const body = await response.text();
  if (!body.includes('<div id="root"></div>')) throw new Error(`Root ausente na rota ${pathname}`);
  return body;
}

async function stopPreview() {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(1500),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

try {
  await waitForServer();
  const routes = [
    '/',
    '/?cargo=presidente',
    '/?q=&cargo=presidente',
    '/?cargo=governador&uf=SP',
    '/?cargo=senador&uf=SP',
    '/?cargo=deputado-federal',
    '/?cargo=deputado-estadual&uf=SP',
    '/metodologia',
    '/fontes',
    '/sobre',
  ];

  let html = '';
  for (const route of routes) {
    const body = await expectAppRoute(route);
    if (!html) html = body;
  }

  const scriptMatch = html.match(/<script[^>]+src="([^"]+\.js)"/i);
  if (!scriptMatch) throw new Error('Bundle JS não localizado no HTML de preview.');
  const bundleResponse = await expectOk(scriptMatch[1], 'Bundle JavaScript indisponível');
  const contentType = bundleResponse.headers.get('content-type') || '';
  if (!contentType.includes('javascript')) throw new Error(`Content-Type inesperado para bundle: ${contentType}`);
  const bundle = await bundleResponse.text();
  for (const marker of [
    'Presidente',
    'Governador',
    'Senador',
    'Deputado Federal',
    'Deputado Estadual',
    'A consulta não conseguiu iniciar.',
    'Como os dados são coletados',
    'Finanças da campanha',
    'Filtros ativos',
  ]) {
    if (!bundle.includes(marker)) throw new Error(`Marcador ausente no bundle servido: ${marker}`);
  }

  const dataChecks = [
    ['/data/candidatos/presidente/brasil.json', 'Presidente'],
    ['/data/candidatos/governador/SP.json', 'Governador SP'],
    ['/data/candidatos/senador/SP.json', 'Senador SP'],
    ['/data/deputados_federais.json', 'Deputado Federal'],
    ['/data/candidatos/deputado-estadual/SP/cards/001.json', 'Deputado Estadual SP'],
  ];
  let federalCandidates = null;
  for (const [pathname, description] of dataChecks) {
    const response = await expectOk(pathname, `Base ${description} indisponível`);
    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) throw new Error(`Base ${description} vazia ou inválida.`);
    if (pathname === '/data/deputados_federais.json') federalCandidates = payload;
  }

  const candidateId = federalCandidates?.find((item) => item?.id_tse)?.id_tse;
  if (!candidateId) throw new Error('Nenhum identificador TSE disponível para testar rota de perfil.');
  await expectAppRoute(`/candidato/${encodeURIComponent(candidateId)}?cargo=deputado-federal`);

  console.log('Smoke de preview concluído: home, cinco cargos, perfil dedicado, páginas institucionais, bundle e bases essenciais responderam corretamente.');
} finally {
  await stopPreview();
}
