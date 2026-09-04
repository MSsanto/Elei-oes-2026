import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dist = path.join(root, 'dist');

const required = [
  'index.html',
  'data/candidatos/presidente/brasil.json',
  'data/candidatos/presidente/manifest.json',
  'data/candidatos/governador/manifest.json',
  'data/candidatos/senador/manifest.json',
  'data/deputados_federais.json',
  'data/metadata.json',
  'data/candidatos/deputado-estadual/manifest.json',
  'data/candidatos/deputado-estadual/SP/manifest.json',
  'data/candidatos/deputado-estadual/SP/cards/001.json',
];

for (const relative of required) {
  await access(path.join(dist, relative));
}

const assetsDir = path.join(dist, 'assets');
const assets = await readdir(assetsDir);
const jsFiles = assets.filter((name) => name.endsWith('.js'));
if (!jsFiles.length) throw new Error('Build sem JavaScript em dist/assets.');

const bundles = await Promise.all(jsFiles.map((name) => readFile(path.join(assetsDir, name), 'utf8')));
const joined = bundles.join('\n');

const routeMarkers = [
  'presidente',
  'governador',
  'senador',
  'deputado-federal',
  'deputado-estadual',
  'Falha ao carregar bootstrap completo da consulta',
];

for (const marker of routeMarkers) {
  if (!joined.includes(marker)) throw new Error(`Marcador de navegação ausente no bundle: ${marker}`);
}

const index = await readFile(path.join(dist, 'index.html'), 'utf8');
if (!index.includes('<div id="root"></div>')) throw new Error('Root da aplicação ausente no index.html.');

console.log('Smoke de navegação concluído: rotas, fallback e artefatos essenciais presentes no build.');
