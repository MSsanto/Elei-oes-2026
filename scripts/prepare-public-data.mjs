import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourceDir = path.join(root, 'data', 'processed');
const targetDir = path.join(root, 'public', 'data');

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

await mkdir(targetDir, { recursive: true });

if (await exists(sourceDir)) {
  await cp(sourceDir, targetDir, { recursive: true, force: true });
  console.log('Dados processados copiados para public/data.');
} else {
  console.warn('data/processed ainda não existe. Gerando conjunto vazio para o primeiro deploy.');
  await writeFile(
    path.join(targetDir, 'deputados_federais.json'),
    JSON.stringify([], null, 2),
    'utf8',
  );
  await writeFile(
    path.join(targetDir, 'metadata.json'),
    JSON.stringify(
      {
        source: 'TSE — Portal de Dados Abertos',
        generated_at_utc: null,
        cargo: 'DEPUTADO FEDERAL',
        records: 0,
        status: 'aguardando_primeira_coleta',
      },
      null,
      2,
    ),
    'utf8',
  );
}

if (await exists(sourceDir)) {
  await import('./build_editorial_phase2.mjs');
}
