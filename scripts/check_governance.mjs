import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sitemap = await readFile(path.join(root, 'dist', 'sitemap.xml'), 'utf8');
for (const pathname of ['/expediente', '/correcoes', '/situacao-candidatura']) {
  if (!sitemap.includes(`https://eleicoes-2026-ebz.pages.dev${pathname}`)) {
    throw new Error(`Rota de governança ausente do sitemap: ${pathname}`);
  }
}

await access(path.join(root, 'docs', 'CORRECOES.md'));
await access(path.join(root, 'docs', 'SITUACAO_CANDIDATURA.md'));

const router = await readFile(path.join(root, 'src', 'appEntry.jsx'), 'utf8');
for (const pathname of ['/expediente', '/correcoes', '/situacao-candidatura']) {
  if (!router.includes(pathname)) throw new Error(`Rota pública ausente do router: ${pathname}`);
}

const governance = await readFile(path.join(root, 'src', 'governancePages.jsx'), 'utf8');
for (const marker of ['não atribui', 'sem criar um rótulo próprio', 'última carga válida']) {
  if (!governance.toLowerCase().includes(marker.toLowerCase())) {
    throw new Error(`Governança pública sem regra editorial esperada: ${marker}`);
  }
}

console.log('Governança validada: expediente, correções, situação de candidatura e sitemap.');
