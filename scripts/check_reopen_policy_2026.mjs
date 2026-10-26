import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const lockPath = 'docs/ARCHIVE_LOCK_2026.md';
const reopeningPath = 'docs/REABERTURA_2026.md';
const event = process.env.GITHUB_EVENT_NAME || '';
if (!existsSync(lockPath) || !['pull_request', 'push'].includes(event)) {
  console.log('Política de reabertura: sem arquivo anterior ou execução local; verificação não aplicável.');
  process.exit(0);
}
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
let previouslyFrozen = false;
try {
  if (event === 'pull_request') {
    const base = process.env.GITHUB_BASE_REF || 'main';
    git(['fetch', '--no-tags', '--depth=1', 'origin', base]);
    git(['cat-file', '-e', 'FETCH_HEAD:' + lockPath]);
  } else {
    git(['fetch', '--no-tags', '--depth=2', 'origin', 'main']);
    git(['cat-file', '-e', 'HEAD^:' + lockPath]);
  }
  previouslyFrozen = true;
} catch {
  // O primeiro merge que cria o marcador de congelamento não é uma reabertura.
}
if (!previouslyFrozen) {
  console.log('Primeira introdução do bloqueio de 2026; nenhuma reabertura anterior exigida.');
  process.exit(0);
}
if (!existsSync(reopeningPath)) {
  throw new Error('Arquivo 2026 congelado: alteração posterior requer docs/REABERTURA_2026.md com autorização explícita, escopo e justificativa.');
}
const content = readFileSync(reopeningPath, 'utf8');
for (const marker of ['Autorização explícita:', 'Responsável:', 'Escopo:', 'Justificativa:', 'Data:']) {
  if (!content.includes(marker)) throw new Error(`Documento de reabertura incompleto: ${marker}`);
}
console.log('Reabertura documentada localizada; revisão humana e aprovação continuam obrigatórias.');
