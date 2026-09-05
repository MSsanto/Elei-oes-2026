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
    '/radar',
    '/siga-o-dinheiro',
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
    'Radar Eleitoral',
    'Siga o Dinheiro',
    'Fornecedor',
    'Patrimônio',
    'Bens informados à Justiça Eleitoral',
    'A consulta não conseguiu iniciar.',
    'Como os dados são coletados',
    'Finanças da campanha',
    'Filtros ativos',
  ]) {
    if (!bundle.includes(marker)) throw new Error(`Marcador ausente no bundle servido: ${marker}`);
  }

  const dataChecks = [
    ['/data/candidatos/presidente/brasil.json', 'Presidente', 'array'],
    ['/data/candidatos/governador/SP.json', 'Governador SP', 'array'],
    ['/data/candidatos/senador/SP.json', 'Senador SP', 'array'],
    ['/data/deputados_federais.json', 'Deputado Federal', 'array'],
    ['/data/candidatos/deputado-estadual/SP/cards/001.json', 'Deputado Estadual SP', 'array'],
    ['/data/editorial/radar.json', 'Radar editorial', 'object'],
    ['/data/editorial/finance-overview.json', 'Siga o Dinheiro', 'object'],
    ['/data/editorial/fornecedores/index.json', 'Fornecedores', 'object'],
  ];
  let federalCandidates = null;
  let supplierIndex = null;
  for (const [pathname, description, kind] of dataChecks) {
    const response = await expectOk(pathname, `Base ${description} indisponível`);
    const payload = await response.json();
    if (kind === 'array' && (!Array.isArray(payload) || payload.length === 0)) throw new Error(`Base ${description} vazia ou inválida.`);
    if (kind === 'object' && (!payload || Array.isArray(payload) || typeof payload !== 'object')) throw new Error(`Base ${description} inválida.`);
    if (pathname === '/data/deputados_federais.json') federalCandidates = payload;
    if (pathname === '/data/editorial/fornecedores/index.json') supplierIndex = payload;
  }

  const candidateId = federalCandidates?.find((item) => item?.id_tse)?.id_tse;
  if (!candidateId) throw new Error('Nenhum identificador TSE disponível para testar rota de perfil.');
  await expectAppRoute(`/candidato/${encodeURIComponent(candidateId)}?cargo=deputado-federal`);
  await expectAppRoute(`/candidato/${encodeURIComponent(candidateId)}?cargo=deputado-federal&aba=patrimonio`);

  const firstSupplier = supplierIndex?.records?.find((item) => /^[a-f0-9]{16}$/i.test(item?.id));
  if (!firstSupplier) throw new Error('Nenhum fornecedor disponível para testar rota dedicada.');
  await expectAppRoute(firstSupplier.href || `/fornecedor/${firstSupplier.id}`);
  const supplierShardResponse = await expectOk(`/data/editorial/fornecedores/shards/${firstSupplier.id.slice(0,2)}.json`, 'Shard editorial de fornecedor indisponível');
  const supplierShard = await supplierShardResponse.json();
  if (!supplierShard[firstSupplier.id]) throw new Error('Fornecedor de teste ausente no shard editorial.');

  console.log('Smoke de preview concluído: núcleo, Radar, Siga o Dinheiro, patrimônio, fornecedor, perfil dedicado e páginas institucionais responderam corretamente.');
} finally {
  await stopPreview();
}
