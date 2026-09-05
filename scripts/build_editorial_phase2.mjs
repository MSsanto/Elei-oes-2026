import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data', 'processed');
const PERSIST = process.argv.includes('--persist');
const OUTPUT = PERSIST ? path.join(DATA, 'editorial') : path.join(ROOT, 'public', 'data', 'editorial');
const PREVIOUS = path.join(DATA, 'editorial');
const FINANCE = path.join(DATA, 'financas-2026');
const SOURCE_URL = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/prestacao-de-contas-eleitorais-2026';

async function exists(target) {
  try { await stat(target); return true; } catch { return false; }
}
async function json(target, fallback = null) {
  try { return JSON.parse(await readFile(target, 'utf8')); } catch { return fallback; }
}
async function writeJson(target, payload, compact = false) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(payload, null, compact ? 0 : 2), 'utf8');
}
function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function safe(value) {
  const text = String(value ?? '').trim();
  return !text || text.startsWith('#') ? '' : text;
}
function normalize(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toUpperCase();
}
function slug(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'fornecedor';
}
function supplierId(name, type = '') {
  return createHash('sha1').update(`${normalize(name)}|${normalize(type)}`).digest('hex').slice(0, 16);
}
function candidateHref(candidate) {
  const id = String(candidate?.id_tse || '').trim();
  return id ? `/candidato/${encodeURIComponent(id)}` : '';
}
function moneyChange(before, after) {
  return Math.round((number(after) - number(before)) * 100) / 100;
}

async function collectCandidateMap() {
  const map = new Map();
  const federal = await json(path.join(DATA, 'deputados_federais.json'), []);
  if (Array.isArray(federal)) federal.forEach(addCandidate);

  const candidatesRoot = path.join(DATA, 'candidatos');
  if (await exists(candidatesRoot)) await walk(candidatesRoot);
  return map;

  function addCandidate(item) {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id_tse || item.SQ_CANDIDATO || '').trim();
    if (!id) return;
    const current = map.get(id) || {};
    map.set(id, {
      ...current,
      id_tse: id,
      nome: safe(item.nome_urna) || safe(item.nome) || current.nome || `Candidatura ${id}`,
      nome_civil: safe(item.nome) || current.nome_civil || '',
      numero: safe(item.numero) || current.numero || '',
      partido: safe(item.partido) || current.partido || '',
      uf: safe(item.uf) || current.uf || '',
      cargo: safe(item.cargo) || current.cargo || '',
      cargo_slug: safe(item.cargo_slug) || current.cargo_slug || '',
      situacao_candidatura: safe(item.situacao_candidatura) || current.situacao_candidatura || '',
    });
  }

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { await walk(full); continue; }
      if (!entry.name.endsWith('.json') || entry.name === 'manifest.json') continue;
      const payload = await json(full, null);
      if (Array.isArray(payload)) payload.forEach(addCandidate);
      else if (payload && typeof payload === 'object') {
        if (payload.id_tse || payload.SQ_CANDIDATO) addCandidate(payload);
        if (Array.isArray(payload.candidatos)) payload.candidatos.forEach(addCandidate);
      }
    }
  }
}

async function collectFinance(candidateMap) {
  const manifest = await json(path.join(FINANCE, 'manifest.json'), {});
  const overview = {
    total_receitas: 0,
    total_despesas_contratadas: 0,
    total_despesas_pagas: 0,
    candidaturas_com_financas: 0,
    receitas_por_fonte: new Map(),
    receitas_por_origem: new Map(),
    despesas_por_categoria: new Map(),
  };
  const financeByCandidate = new Map();
  const suppliersFallback = new Map();
  const shardsDir = path.join(FINANCE, 'shards');
  if (!(await exists(shardsDir))) return { manifest, overview: serialOverview(overview), financeByCandidate, suppliersFallback };

  const files = (await readdir(shardsDir)).filter((name) => name.endsWith('.json')).sort();
  for (const file of files) {
    const payload = await json(path.join(shardsDir, file), {});
    for (const [id, record] of Object.entries(payload || {})) {
      const summary = record?.resumo || {};
      const finance = {
        total_receitas: number(summary.total_receitas),
        total_despesas_contratadas: number(summary.total_despesas_contratadas),
        total_despesas_pagas: number(summary.total_despesas_pagas),
      };
      financeByCandidate.set(String(id), finance);
      overview.candidaturas_com_financas += 1;
      overview.total_receitas += finance.total_receitas;
      overview.total_despesas_contratadas += finance.total_despesas_contratadas;
      overview.total_despesas_pagas += finance.total_despesas_pagas;
      addRows(overview.receitas_por_fonte, record.receitas_por_fonte);
      addRows(overview.receitas_por_origem, record.receitas_por_origem);
      addRows(overview.despesas_por_categoria, record.despesas_por_categoria);

      for (const supplier of Array.isArray(record.principais_fornecedores) ? record.principais_fornecedores : []) {
        const name = safe(supplier.nome);
        if (!name) continue;
        const type = safe(supplier.tipo) || 'Não informado';
        const key = supplierId(name, type);
        const current = suppliersFallback.get(key) || { id: key, nome: name, tipo: type, valor_total: 0, candidaturas: new Map() };
        const value = number(supplier.valor);
        current.valor_total += value;
        current.candidaturas.set(String(id), (current.candidaturas.get(String(id)) || 0) + value);
        suppliersFallback.set(key, current);
      }
    }
  }
  return { manifest, overview: serialOverview(overview), financeByCandidate, suppliersFallback };

  function addRows(store, rows) {
    for (const item of Array.isArray(rows) ? rows : []) {
      const label = safe(item.categoria) || 'Não informado';
      store.set(label, (store.get(label) || 0) + number(item.valor));
    }
  }
  function serialRows(store) {
    return [...store.entries()].map(([categoria, valor]) => ({ categoria, valor: Math.round(valor * 100) / 100 }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR'));
  }
  function serialOverview(value) {
    return {
      total_receitas: Math.round(value.total_receitas * 100) / 100,
      total_despesas_contratadas: Math.round(value.total_despesas_contratadas * 100) / 100,
      total_despesas_pagas: Math.round(value.total_despesas_pagas * 100) / 100,
      candidaturas_com_financas: value.candidaturas_com_financas,
      receitas_por_fonte: serialRows(value.receitas_por_fonte),
      receitas_por_origem: serialRows(value.receitas_por_origem),
      despesas_por_categoria: serialRows(value.despesas_por_categoria),
    };
  }
}

function buildSnapshot(candidateMap, financeByCandidate, generatedAt) {
  const ids = new Set([...candidateMap.keys(), ...financeByCandidate.keys()]);
  const records = {};
  for (const id of [...ids].sort()) {
    const candidate = candidateMap.get(id) || {};
    const finance = financeByCandidate.get(id) || {};
    records[id] = {
      nome: candidate.nome || '',
      partido: candidate.partido || '',
      uf: candidate.uf || '',
      cargo: candidate.cargo || '',
      situacao_candidatura: candidate.situacao_candidatura || '',
      total_receitas: number(finance.total_receitas),
      total_despesas_contratadas: number(finance.total_despesas_contratadas),
      total_despesas_pagas: number(finance.total_despesas_pagas),
    };
  }
  return { schema_version: 1, generated_at_utc: generatedAt, records };
}

function diffRadar(previous, current, candidateMap) {
  const events = [];
  if (!previous?.records) return events;
  const timestamp = current.generated_at_utc;
  for (const [id, after] of Object.entries(current.records || {})) {
    const before = previous.records[id];
    const candidate = candidateMap.get(id) || { id_tse: id, nome: after.nome, partido: after.partido, uf: after.uf, cargo: after.cargo };
    const common = {
      timestamp,
      candidate_id: id,
      candidate_name: candidate.nome || after.nome || `Candidatura ${id}`,
      cargo: candidate.cargo || after.cargo || '',
      partido: candidate.partido || after.partido || '',
      uf: candidate.uf || after.uf || '',
      href: candidateHref({ id_tse: id }),
    };
    if (!before) {
      events.push({ ...common, id: `${timestamp}:${id}:new`, type: 'cadastro', title: 'Candidatura incorporada à base processada', detail: 'O registro passou a constar na carga local utilizada pelo projeto.' });
      continue;
    }
    if (before.situacao_candidatura && after.situacao_candidatura && before.situacao_candidatura !== after.situacao_candidatura) {
      events.push({ ...common, id: `${timestamp}:${id}:status`, type: 'cadastro', title: 'Situação da candidatura atualizada', detail: `${before.situacao_candidatura} → ${after.situacao_candidatura}` });
    }
    for (const [field, label] of [
      ['total_receitas', 'Total de receitas atualizado'],
      ['total_despesas_contratadas', 'Total de despesas contratadas atualizado'],
      ['total_despesas_pagas', 'Total de despesas pagas atualizado'],
    ]) {
      if (number(before[field]) === number(after[field])) continue;
      events.push({
        ...common,
        id: `${timestamp}:${id}:${field}`,
        type: 'financas',
        title: label,
        before: number(before[field]),
        after: number(after[field]),
        delta: moneyChange(before[field], after[field]),
        detail: 'Diferença detectada entre duas cargas processadas da fonte oficial.',
      });
    }
  }
  return events;
}

async function loadCompleteSuppliers(candidateMap) {
  const base = path.join(FINANCE, 'fornecedores');
  const index = await json(path.join(base, 'index.json'), null);
  if (!Array.isArray(index)) return null;
  const records = new Map();
  const shards = path.join(base, 'shards');
  if (await exists(shards)) {
    for (const file of (await readdir(shards)).filter((name) => name.endsWith('.json')).sort()) {
      const payload = await json(path.join(shards, file), {});
      Object.entries(payload || {}).forEach(([id, record]) => records.set(id, enrich(record)));
    }
  }
  return {
    coverage: 'integral_registros_despesas_contratadas',
    note: 'Índice construído a partir de todos os registros de despesas contratadas processados na carga financeira.',
    index: index.map((item) => ({ ...item, href: `/fornecedor/${item.id}-${slug(item.nome)}` })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    records,
  };

  function enrich(record) {
    return {
      ...record,
      candidaturas: (record.candidaturas || []).map((item) => {
        const candidate = candidateMap.get(String(item.id_tse)) || {};
        return { ...item, nome: candidate.nome || `Candidatura ${item.id_tse}`, partido: candidate.partido || '', uf: candidate.uf || '', cargo: candidate.cargo || '', href: candidateHref({ id_tse: item.id_tse }) };
      }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    };
  }
}

function fallbackSuppliers(store, candidateMap) {
  const records = new Map();
  const index = [];
  for (const entry of store.values()) {
    const candidaturas = [...entry.candidaturas.entries()].map(([id_tse, valor]) => {
      const candidate = candidateMap.get(String(id_tse)) || {};
      return { id_tse, valor: Math.round(valor * 100) / 100, nome: candidate.nome || `Candidatura ${id_tse}`, partido: candidate.partido || '', uf: candidate.uf || '', cargo: candidate.cargo || '', href: candidateHref({ id_tse }) };
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const record = { id: entry.id, nome: entry.nome, tipo: entry.tipo, valor_total: Math.round(entry.valor_total * 100) / 100, candidaturas };
    records.set(entry.id, record);
    index.push({ id: entry.id, nome: entry.nome, tipo: entry.tipo, valor_total: record.valor_total, candidaturas: candidaturas.length, href: `/fornecedor/${entry.id}-${slug(entry.nome)}` });
  }
  index.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    coverage: 'parcial_principais_fornecedores_por_candidatura',
    note: 'Índice inicial construído com os principais fornecedores armazenados em cada perfil financeiro. A próxima coleta financeira, com o novo pipeline, amplia a cobertura para todos os registros de despesas contratadas processados.',
    index,
    records,
  };
}

async function writeSuppliers(suppliers) {
  const base = path.join(OUTPUT, 'fornecedores');
  await writeJson(path.join(base, 'index.json'), {
    schema_version: 1,
    coverage: suppliers.coverage,
    note: suppliers.note,
    records: suppliers.index,
  });
  const shards = new Map();
  for (const [id, record] of suppliers.records.entries()) {
    const key = id.slice(0, 2);
    if (!shards.has(key)) shards.set(key, {});
    shards.get(key)[id] = record;
  }
  for (const [key, payload] of shards.entries()) await writeJson(path.join(base, 'shards', `${key}.json`), payload, true);
}

const candidateMap = await collectCandidateMap();
const finance = await collectFinance(candidateMap);
const financeGeneratedAt = finance.manifest?.generated_at_utc || new Date().toISOString();
const previousSnapshot = await json(path.join(PREVIOUS, 'snapshot.json'), null);
const previousRadar = await json(path.join(PREVIOUS, 'radar.json'), { events: [] });
const snapshot = buildSnapshot(candidateMap, finance.financeByCandidate, financeGeneratedAt);
const newEvents = diffRadar(previousSnapshot, snapshot, candidateMap);
const eventMap = new Map();
for (const event of [...newEvents, ...(previousRadar?.events || [])]) if (event?.id && !eventMap.has(event.id)) eventMap.set(event.id, event);
const events = [...eventMap.values()].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 500);

const completeSuppliers = await loadCompleteSuppliers(candidateMap);
const suppliers = completeSuppliers || fallbackSuppliers(finance.suppliersFallback, candidateMap);

await mkdir(OUTPUT, { recursive: true });
await writeJson(path.join(OUTPUT, 'snapshot.json'), snapshot, true);
await writeJson(path.join(OUTPUT, 'radar.json'), {
  schema_version: 1,
  mode: previousSnapshot ? 'changes' : 'baseline',
  generated_at_utc: financeGeneratedAt,
  source: 'TSE — dados eleitorais e Prestação de Contas Eleitorais 2026',
  source_url: SOURCE_URL,
  methodology: previousSnapshot
    ? 'Eventos são gerados somente quando um campo acompanhado difere entre duas cargas processadas consecutivas.'
    : 'Esta é a primeira linha de base editorial. Alterações passam a ser registradas a partir da próxima carga comparável.',
  events,
});
await writeJson(path.join(OUTPUT, 'finance-overview.json'), {
  schema_version: 1,
  generated_at_utc: financeGeneratedAt,
  source: finance.manifest?.source || 'TSE — Prestação de Contas Eleitorais 2026',
  source_url: finance.manifest?.source_url || SOURCE_URL,
  ...finance.overview,
  fornecedores: {
    coverage: suppliers.coverage,
    note: suppliers.note,
    records: suppliers.index.length,
  },
});
await writeSuppliers(suppliers);
await writeJson(path.join(OUTPUT, 'manifest.json'), {
  schema_version: 1,
  generated_at_utc: financeGeneratedAt,
  candidate_records: candidateMap.size,
  finance_records: finance.overview.candidaturas_com_financas,
  radar_events: events.length,
  supplier_records: suppliers.index.length,
  supplier_coverage: suppliers.coverage,
  persisted: PERSIST,
});

console.log(`Camada editorial gerada: ${events.length} eventos no Radar; ${suppliers.index.length} fornecedores; ${finance.overview.candidaturas_com_financas} perfis financeiros.`);
