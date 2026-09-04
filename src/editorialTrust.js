import './editorialTrust.css';

const TSE_CANDIDATES = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026';
const TSE_ACCOUNTS = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/prestacao-de-contas-eleitorais-2026';
const CAMARA_DATA = 'https://dadosabertos.camara.leg.br/';
const REPOSITORY_DATA = 'https://github.com/MSsanto/Elei-oes-2026/tree/main/data/processed';

function formatDate(value) {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function shortHash(value) {
  const text = String(value || '').trim();
  return text ? `${text.slice(0, 12)}…${text.slice(-8)}` : 'Não disponível para esta camada';
}

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function setText(root, selector, value) {
  const node = root.querySelector(selector);
  if (node) node.textContent = value;
}

function fillAuditCard(section, key, payload, type) {
  const card = section.querySelector(`[data-audit-card="${key}"]`);
  if (!card) return;

  if (!payload) {
    setText(card, '[data-audit-count]', 'Metadado indisponível');
    setText(card, '[data-audit-date]', 'A fonte permanece acessível pelos links oficiais.');
    setText(card, '[data-audit-hash]', '—');
    return;
  }

  if (type === 'candidaturas') {
    setText(card, '[data-audit-count]', `${Number(payload.records || 0).toLocaleString('pt-BR')} registros na carga federal`);
    setText(card, '[data-audit-date]', `Processado em ${formatDate(payload.generated_at_utc)}`);
    setText(card, '[data-audit-hash]', `SHA-256 ${shortHash(payload.sha256)}`);
  } else if (type === 'financas') {
    setText(card, '[data-audit-count]', `${Number(payload.candidates || 0).toLocaleString('pt-BR')} perfis financeiros`);
    setText(card, '[data-audit-date]', `Processado em ${formatDate(payload.generated_at_utc)}`);
    setText(card, '[data-audit-hash]', `SHA-256 ${shortHash(payload.transport?.sha256)}`);
  } else if (type === 'camara') {
    setText(card, '[data-audit-count]', `${Number(payload.perfis_confirmados || 0).toLocaleString('pt-BR')} perfis com vínculo confirmado`);
    setText(card, '[data-audit-date]', `Atividade processada em ${formatDate(payload.generated_at_utc)}`);
    setText(card, '[data-audit-hash]', 'Fonte atualizada de forma independente da base eleitoral');
  }
}

function addHomeAudit() {
  const home = document.querySelector('.project-home');
  if (!home || home.querySelector('.home-data-status')) return;
  const methodology = home.querySelector('.home-methodology');
  if (!methodology) return;

  const section = document.createElement('section');
  section.className = 'home-data-status';
  section.id = 'auditoria';
  section.setAttribute('aria-labelledby', 'auditoria-title');
  section.innerHTML = `
    <div class="editorial-section-heading">
      <span>TRANSPARÊNCIA DA BASE</span>
      <h2 id="auditoria-title">O dado pode ser conferido.</h2>
      <p>Além de indicar a fonte oficial, o projeto expõe a data de processamento e, quando a coleta possui arquivo bruto verificável, um trecho do hash SHA-256 usado para conferir se o conteúdo recebido mudou.</p>
    </div>
    <div class="editorial-audit-grid">
      <article data-audit-card="candidaturas">
        <span class="editorial-source-label">TSE · CANDIDATURAS 2026</span>
        <strong data-audit-count>Carregando metadados…</strong>
        <small data-audit-date>—</small>
        <code data-audit-hash>—</code>
        <a href="${TSE_CANDIDATES}" target="_blank" rel="noreferrer">Abrir fonte oficial ↗</a>
      </article>
      <article data-audit-card="financas">
        <span class="editorial-source-label">TSE · PRESTAÇÃO DE CONTAS</span>
        <strong data-audit-count>Carregando metadados…</strong>
        <small data-audit-date>—</small>
        <code data-audit-hash>—</code>
        <a href="${TSE_ACCOUNTS}" target="_blank" rel="noreferrer">Abrir fonte oficial ↗</a>
      </article>
      <article data-audit-card="camara">
        <span class="editorial-source-label">CÂMARA · DADOS ABERTOS</span>
        <strong data-audit-count>Carregando metadados…</strong>
        <small data-audit-date>—</small>
        <code data-audit-hash>—</code>
        <a href="${CAMARA_DATA}" target="_blank" rel="noreferrer">Abrir fonte oficial ↗</a>
      </article>
    </div>
    <div class="editorial-audit-footer">
      <p>Datas acima indicam o processamento realizado pelo projeto, não necessariamente a data de alteração de cada registro individual na fonte.</p>
      <a href="${REPOSITORY_DATA}" target="_blank" rel="noreferrer">Ver arquivos processados no GitHub ↗</a>
    </div>
  `;
  methodology.insertAdjacentElement('beforebegin', section);

  Promise.allSettled([
    loadJson('/data/metadata.json'),
    loadJson('/data/financas-2026/manifest.json'),
    loadJson('/data/camara/atividade_metadata.json'),
  ]).then(([candidates, finances, chamber]) => {
    fillAuditCard(section, 'candidaturas', candidates.status === 'fulfilled' ? candidates.value : null, 'candidaturas');
    fillAuditCard(section, 'financas', finances.status === 'fulfilled' ? finances.value : null, 'financas');
    fillAuditCard(section, 'camara', chamber.status === 'fulfilled' ? chamber.value : null, 'camara');
  });
}

function addConsultationProvenance() {
  const stats = document.querySelector('.stats-wrap');
  if (!stats || document.querySelector('.consultation-provenance')) return;

  const cargo = new URLSearchParams(window.location.search).get('cargo');
  const strip = document.createElement('aside');
  strip.className = 'consultation-provenance';
  strip.setAttribute('aria-label', 'Origem e auditoria dos dados');

  const sourceLinks = [
    `<a href="${TSE_CANDIDATES}" target="_blank" rel="noreferrer">Candidaturas: TSE ↗</a>`,
    `<a href="${TSE_ACCOUNTS}" target="_blank" rel="noreferrer">Finanças: TSE ↗</a>`,
  ];
  if (cargo === 'deputado-federal') sourceLinks.push(`<a href="${CAMARA_DATA}" target="_blank" rel="noreferrer">Atividade parlamentar: Câmara ↗</a>`);

  strip.innerHTML = `
    <div><strong>Origem e auditoria</strong><span>Dados oficiais organizados pelo projeto; a data da carga aparece acima.</span></div>
    <nav aria-label="Fontes desta consulta">${sourceLinks.join('')}<a href="/#metodologia">Metodologia</a><a href="/#auditoria">Status das bases</a></nav>
  `;
  stats.insertAdjacentElement('afterend', strip);
}

function hideTechnicalId(detailGrid) {
  if (!detailGrid) return '';
  const rows = [...detailGrid.querySelectorAll(':scope > div')];
  const technical = rows.find((row) => row.querySelector('dt')?.textContent?.trim() === 'Identificador TSE');
  if (!technical) return '';
  const value = technical.querySelector('dd')?.textContent?.trim() || '';
  technical.hidden = true;
  technical.setAttribute('aria-hidden', 'true');
  return value;
}

function sourceLink(href, label) {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = `${label} ↗`;
  return link;
}

function addProfileSources(modal) {
  if (!modal || modal.querySelector('.profile-source-methodology')) return;
  const detailGrid = modal.querySelector('.detail-grid');
  if (!detailGrid) return;

  const candidateId = hideTechnicalId(detailGrid) || new URLSearchParams(window.location.search).get('candidato') || '';
  const hasChamber = Boolean(modal.querySelector('.chamber-module') || modal.querySelector('.coming-soon'));

  const details = document.createElement('details');
  details.className = 'profile-source-methodology';
  const summary = document.createElement('summary');
  summary.innerHTML = '<span><strong>Fonte e metodologia</strong><small>Origem, identificador técnico e critérios de vinculação</small></span><b aria-hidden="true">+</b>';
  details.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'profile-source-body';

  const explanation = document.createElement('p');
  explanation.textContent = 'Os dados de candidatura são apresentados conforme a carga pública do TSE. Informações financeiras vêm da prestação de contas eleitoral. Dados da Câmara só são associados quando a correspondência entre as fontes atende aos critérios documentados; ausência de vínculo não indica irregularidade.';
  body.appendChild(explanation);

  if (candidateId) {
    const idRow = document.createElement('div');
    idRow.className = 'profile-technical-id';
    const label = document.createElement('span');
    label.textContent = 'Identificador TSE para rastreabilidade';
    const code = document.createElement('code');
    code.textContent = candidateId;
    idRow.append(label, code);
    body.appendChild(idRow);
  }

  const links = document.createElement('div');
  links.className = 'profile-source-links';
  links.append(
    sourceLink(TSE_CANDIDATES, 'Candidatos 2026 — TSE'),
    sourceLink(TSE_ACCOUNTS, 'Prestação de Contas 2026 — TSE'),
  );
  if (hasChamber) links.appendChild(sourceLink(CAMARA_DATA, 'Dados Abertos — Câmara'));
  links.appendChild(sourceLink(REPOSITORY_DATA, 'Dados processados — GitHub'));

  const method = document.createElement('a');
  method.href = '/#metodologia';
  method.textContent = 'Ler metodologia do projeto';
  links.appendChild(method);
  body.appendChild(links);
  details.appendChild(body);
  detailGrid.insertAdjacentElement('afterend', details);
}

function scan() {
  addHomeAudit();
  addConsultationProvenance();
  document.querySelectorAll('.modal').forEach(addProfileSources);
}

const observer = new MutationObserver(scan);
observer.observe(document.body, { childList: true, subtree: true });
scan();
