import { access, readFile, readdir } from 'node:fs/promises';
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
  'data/editorial/radar.json',
  'data/editorial/finance-overview.json',
  'data/editorial/fornecedores/index.json',
];

for (const relative of required) await access(path.join(dist, relative));

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
  '/radar',
  '/siga-o-dinheiro',
  'Radar Eleitoral',
  'Siga o Dinheiro',
  'Fornecedor',
  'Patrimônio',
  'Bens informados à Justiça Eleitoral',
  'A consulta não conseguiu iniciar.',
  'Finanças da campanha',
  'Filtros ativos',
];
for (const marker of routeMarkers) {
  if (!bundle.includes(marker)) throw new Error(`Marcador de navegação ausente no bundle: ${marker}`);
}

const editorialManifest = JSON.parse(await readFile(path.join(dist, 'data/editorial/manifest.json'), 'utf8'));
if (!Number(editorialManifest.finance_records)) throw new Error('Camada editorial sem perfis financeiros.');
const supplierIndex = JSON.parse(await readFile(path.join(dist, 'data/editorial/fornecedores/index.json'), 'utf8'));
if (!Array.isArray(supplierIndex.records) || supplierIndex.records.length === 0) throw new Error('Diretório editorial de fornecedores vazio ou inválido.');

const firstSupplier = supplierIndex.records.find((item) => /^[a-f0-9]{16}$/i.test(item?.id));
if (!firstSupplier) throw new Error('Diretório editorial sem identificador válido de fornecedor.');
await access(path.join(dist, `data/editorial/fornecedores/shards/${firstSupplier.id.slice(0, 2).toLowerCase()}.json`));

const index = await readFile(path.join(dist, 'index.html'), 'utf8');
if (!index.includes('<div id="root"></div>')) throw new Error('Root da aplicação ausente no index.html.');
if ((index.match(/<script type="module"/g) || []).length !== 1) throw new Error('O index deve carregar exatamente um script module.');
if (!index.includes('/assets/')) throw new Error('index.html não referencia o bundle processado pelo Vite.');

const redirects = await readFile(path.join(dist, '_redirects'), 'utf8');
if (!redirects.includes('/* /index.html 200')) throw new Error('Fallback SPA não foi copiado para o artefato de produção.');

console.log(`Smoke estático concluído: núcleo, Fase Editorial, patrimônio, ${supplierIndex.records.length} fornecedores e fallback SPA presentes.`);
