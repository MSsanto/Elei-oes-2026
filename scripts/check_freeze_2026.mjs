import { readFile } from 'node:fs/promises';

const recurringDataWorkflows = [
  '.github/workflows/coleta-online.yml',
  '.github/workflows/coleta-financas-2026.yml',
  '.github/workflows/coleta-patrimonio-2026.yml',
  '.github/workflows/watchdog-cloud.yml',
];

const automaticProductionWorkflows = [
  ...recurringDataWorkflows,
  '.github/workflows/deploy-tse-browser-probe.yml',
];

for (const path of recurringDataWorkflows) {
  const content = await readFile(path, 'utf8');
  if (/^\s*schedule\s*:/m.test(content) || /^\s*-?\s*cron\s*:/m.test(content)) {
    throw new Error(`Workflow congelado ainda possui agenda recorrente: ${path}`);
  }
  if (!/^\s*workflow_dispatch\s*:/m.test(content)) {
    throw new Error(`Workflow congelado perdeu contingencia manual: ${path}`);
  }
}

for (const path of automaticProductionWorkflows) {
  const content = await readFile(path, 'utf8');
  if (/^\s*push\s*:/m.test(content)) {
    throw new Error(`Workflow de producao congelado ainda reage a push: ${path}`);
  }
}

console.log('OK: congelamento 2026 preservado; sem cron de dados e sem deploy/coleta automatica por push.');
