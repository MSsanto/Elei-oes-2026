import { access, readFile } from 'node:fs/promises';

const blocked = [
  'coleta-online.yml',
  'coleta-financas-2026.yml',
  'coleta-patrimonio-2026.yml',
  'construir-historico-ddd.yml',
  'watchdog-cloud.yml',
  'importar-resultados-2026.yml',
  'deploy-tse-browser-probe.yml',
  'deploy-pages-encerramento-2026.yml',
  'final-refresh-2026.yml',
  'test-moneyprinterturbo.yml',
];
await access('docs/ARCHIVE_LOCK_2026.md');
for (const file of blocked) {
  const path = `.github/workflows/${file}`;
  const content = await readFile(path, 'utf8');
  for (const trigger of ['schedule', 'cron', 'push', 'pull_request', 'workflow_run', 'repository_dispatch']) {
    if (new RegExp(`^\\s*${trigger}\\s*:`, 'm').test(content)) {
      throw new Error(`Arquivo congelado possui gatilho ${trigger}: ${path}`);
    }
  }
  if (!/^\s*workflow_dispatch\s*:/m.test(content)) throw new Error(`Workflow histórico sem entrada manual: ${path}`);
  if (!/^\s{4}if:\s*false\b/m.test(content)) throw new Error(`Workflow histórico sem bloqueio de job: ${path}`);
  if (/^\s*contents:\s*write\b/m.test(content)) throw new Error(`Workflow histórico ainda tem escrita em contents: ${path}`);
}
for (const path of ['scripts/windows/coletar_e_publicar.ps1', 'scripts/windows/instalar_atualizacao_automatica.ps1']) {
  const content = await readFile(path, 'utf8');
  if (!content.includes('ARCHIVE_LOCK_2026.md')) throw new Error(`Script local sem trava de arquivo: ${path}`);
}
console.log('OK: arquivo 2026 bloqueado; coletas, deploys e watchdog sem gatilhos automáticos ou permissões de escrita.');
