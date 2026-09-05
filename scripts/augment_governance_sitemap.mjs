import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sitemapPath = path.join(root, 'public', 'sitemap.xml');
const SITE_ORIGIN = String(process.env.PUBLIC_SITE_ORIGIN || 'https://eleicoes-2026-ebz.pages.dev').replace(/\/+$/, '');
const governancePaths = ['/expediente', '/correcoes', '/situacao-candidatura'];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

let sitemap = await readFile(sitemapPath, 'utf8');
let added = 0;
for (const pathname of governancePaths) {
  const location = escapeXml(`${SITE_ORIGIN}${pathname}`);
  if (sitemap.includes(`<loc>${location}</loc>`)) continue;
  const entry = `  <url>\n    <loc>${location}</loc>\n  </url>\n`;
  sitemap = sitemap.replace('</urlset>', `${entry}</urlset>`);
  added += 1;
}
await writeFile(sitemapPath, sitemap, 'utf8');
console.log(`Sitemap de governança: ${added} rota(s) adicionada(s); ${governancePaths.length} rota(s) garantida(s).`);
