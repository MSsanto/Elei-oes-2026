import { spawn } from 'node:child_process';
import process from 'node:process';

const host = '127.0.0.1';
const port = 4173;
const base = `http://${host}:${port}`;
const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--host', host, '--port', String(port), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production' },
});

let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/`, { redirect: 'manual' });
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Preview não iniciou. ${stderr}`);
}

async function expectOk(path, description) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual' });
  if (!response.ok) throw new Error(`${description}: HTTP ${response.status} em ${path}`);
  return response;
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
  ];

  let html = '';
  for (const route of routes) {
    const response = await expectOk(route, 'Rota da aplicação indisponível');
    const body = await response.text();
    if (!body.includes('<div id="root"></div>')) throw new Error(`Root ausente na rota ${route}`);
    if (!html) html = body;
  }

  const scriptMatch = html.match(/<script[^>]+src="([^"]+\.js)"/i);
  if (!scriptMatch) throw new Error('Bundle JS não localizado no HTML de preview.');
  const bundleResponse = await expectOk(scriptMatch[1], 'Bundle JavaScript indisponível');
  const contentType = bundleResponse.headers.get('content-type') || '';
  if (!contentType.includes('javascript')) throw new Error(`Content-Type inesperado para bundle: ${contentType}`);
  const bundle = await bundleResponse.text();
  for (const marker of ['Presidente','Governador','Senador','Deputado Federal','Deputado Estadual','A consulta não conseguiu iniciar.']) {
    if (!bundle.includes(marker)) throw new Error(`Marcador ausente no bundle servido: ${marker}`);
  }

  const dataChecks = [
    ['/data/candidatos/presidente/brasil.json', 'Presidente'],
    ['/data/candidatos/governador/SP.json', 'Governador SP'],
    ['/data/candidatos/senador/SP.json', 'Senador SP'],
    ['/data/deputados_federais.json', 'Deputado Federal'],
    ['/data/candidatos/deputado-estadual/SP/cards/001.json', 'Deputado Estadual SP'],
  ];
  for (const [path, description] of dataChecks) {
    const response = await expectOk(path, `Base ${description} indisponível`);
    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) throw new Error(`Base ${description} vazia ou inválida.`);
  }

  console.log('Smoke de preview concluído: home, cinco cargos, bundle e bases essenciais responderam corretamente.');
} finally {
  child.kill('SIGTERM');
  await sleep(100);
  if (!child.killed) child.kill('SIGKILL');
}
