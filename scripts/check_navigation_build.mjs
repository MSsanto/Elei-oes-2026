import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dist = path.join(root, 'dist');

const required = [
  'index.html',
  '_redirects',
  'data/candidatos/presidente/brasil.json',
  'data/candidatos/presidente/manifest.json',
  'data/candidatos/governador/manifest.json',
  'data/candidatos/senador/manifest.json',
  'data/deputados_federais.json',
  'data/metadata.json',
  'data/candidatos/deputado-estadual/manifest.json',
  'data/candidatos/deputado-estadual/SP/manifest.json',
  'data/candidatos/deputado-estadual/SP/cards/001.json',
  'data/editorial/manifest.json',
  'data/resultados-2026/status-por-candidato.json',
  'data/editorial/radar.json',
  'data/editorial/finance-overview.json',
  'data/editorial/fornecedores/index.json',
];

for (const relative of required) await access(path.join(dist, relative));

// Limite de 25 MiB por arquivo no Cloudflare Pages, inclusive JSON em public/data.
const maxAssetBytes = 25 * 1024 * 1024;
async function inspectAssetSizes(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      await inspectAssetSizes(full);
    } else if (item.isFile()) {
      const details = await stat(full);
      if (details.size > maxAssetBytes) {
        throw new Error(`Arquivo incompatível com Cloudflare Pages: ${path.relative(dist, full)} (${(details.size / 1024 / 1024).toFixed(1)} MiB)`);
      }
    }
  }
}
await inspectAssetSizes(dist);

const assetsDir = path.join(dist, 'assets');
const assets = await readdir(assetsDir);
const jsFiles = assets.filter((name) => name.endsWith('.js'));
if (jsFiles.length !== 1) {
  throw new Error(`Esperado um único bundle JS de entrada para reduzir falhas de bootstrap; encontrados ${jsFiles.length}.`);
}

const bundle = await readFile(path.join(assetsDir, jsFiles[0]), 'utf8');
const routeMarkers = [
  'presidente',
  'governador',
  'senador',
  'deputado-federal',
  'deputado-estadual',
  '/candidato/',
  '/metodologia',
  '/fontes',
  '/sobre',
  '/encerramento-2026',
  'O projeto Eleições 2026 foi concluído.',
  '/eleitos',
  'Eleitas e eleitos',
  'PANORAMA ELEITORAL',
  '/radar',
  '/siga-o-dinheiro',
  'Radar Eleitoral',
  'Siga o Dinheiro',
  'Fornecedor',
  'Patrimônio',
  'Bens informados à Justiça Eleitoral',
  'A consulta não conseguiu iniciar.',
  'Não confirmado',
  'Não eleito',
  'Eleito',
  'Finanças da campanha',
  'Filtros ativos',
];
for (const marker of routeMarkers) {
  if (!bundle.includes(marker)) throw new Error(`Marcador de navegação ausente no bundle: ${marker}`);
}

const editorialManifest = JSON.parse(await readFile(path.join(dist, 'data/editorial/manifest.json'), 'utf8'));
if (!Number(editorialManifest.finance_records)) throw new Error('Camada editorial sem perfis financeiros.');
const supplierIndex = JSON.parse(await readFile(path.join(dist, 'data/editorial/fornecedores/index.json'), 'utf8'));
if (!supplierIndex.sharded || !Number(supplierIndex.total_records) || !Array.isArray(supplierIndex.records) || supplierIndex.records.length === 0) {
  throw new Error('Diretório editorial de fornecedores fragmentado vazio ou inválido.');
}
if (supplierIndex.total_records !== editorialManifest.supplier_records) throw new Error('Total do índice de fornecedores difere do manifest editorial.');
const firstSupplier = supplierIndex.records.find((item) => /^[a-f0-9]{16}$/i.test(item?.id));
if (!firstSupplier) throw new Error('Diretório editorial sem identificador válido de fornecedor.');
const prefix = String(firstSupplier.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2).padEnd(2, '_');
const lookupFile = path.join(dist, `data/editorial/fornecedores/busca/${prefix}-001.json`);
const lookupRows = JSON.parse(await readFile(lookupFile, 'utf8'));
if (!lookupRows.some((record) => record.id === firstSupplier.id)) throw new Error('Amostra de fornecedor não encontrada no arquivo de busca.');
await access(path.join(dist, `data/editorial/fornecedores/shards/${firstSupplier.id.slice(0, 2).toLowerCase()}.json`));
try {
  await access(path.join(dist, 'data/financas-2026/fornecedores/index.json'));
  throw new Error('Índice de origem de 88 MB copiado indevidamente para o deploy.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const index = await readFile(path.join(dist, 'index.html'), 'utf8');
if (!index.includes('<div id="root"></div>')) throw new Error('Root da aplicação ausente no index.html.');
if ((index.match(/<script type="module"/g) || []).length !== 1) throw new Error('O index deve carregar exatamente um script module.');
if (!index.includes('/assets/')) throw new Error('index.html não referencia o bundle processado pelo Vite.');

const redirects = await readFile(path.join(dist, '_redirects'), 'utf8');
if (!redirects.includes('/* /index.html 200')) throw new Error('Fallback SPA não foi copiado para o artefato de produção.');

console.log(`Smoke estático concluído: núcleo, Fase Editorial, patrimônio, ${supplierIndex.total_records} fornecedores em fragmentos e fallback SPA presentes.`);
