import { readFile } from 'node:fs/promises';

const sources = {
  elected: await readFile('src/ElectedCandidatesPage.jsx', 'utf8'),
  context: await readFile('src/ElectionContext.jsx', 'utf8'),
  electedStyles: await readFile('src/electedCandidates.css', 'utf8'),
  contextStyles: await readFile('src/electionContext.css', 'utf8'),
  router: await readFile('src/appEntry.jsx', 'utf8'),
  navigation: await readFile('src/PlatformHeader.jsx', 'utf8'),
};
const required = [
  ['elected', '<main'],
  ['elected', '<h1>'],
  ['elected', 'aria-label="Filtros de consulta"'],
  ['elected', 'aria-live="polite"'],
  ['elected', 'role="alert"'],
  ['elected', 'type="search"'],
  ['elected', '<label>'],
  ['context', '<dl'],
  ['context', '<dt>'],
  ['context', '<dd>'],
  ['context', 'aria-labelledby="election-context-title"'],
  ['electedStyles', ':focus-visible'],
  ['contextStyles', ':focus-visible'],
  ['router', "pathname === '/eleitos'"],
  ['navigation', "href: '/eleitos'"],
];
for (const [source, marker] of required) {
  if (!sources[source].includes(marker)) throw new Error(`Verificação semântica de acessibilidade: falta ${marker} em ${source}`);
}
console.log('OK: rotas, semântica de headings, rótulos, região viva, mensagens de erro e foco visível conferidos estaticamente.');
