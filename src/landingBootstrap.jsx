import React from 'react';
import { createRoot } from 'react-dom/client';
import './home.css';

const CARGOS = [
  { slug: 'presidente', eyebrow: 'BRASIL', title: 'Presidente', text: 'Consulta nacional.' },
  { slug: 'governador', eyebrow: 'POR UF', title: 'Governador', text: 'Consulta por estado.' },
  { slug: 'senador', eyebrow: 'POR UF', title: 'Senador', text: 'Consulta por estado.' },
  { slug: 'deputado-federal', eyebrow: 'CÂMARA', title: 'Deputado Federal', text: 'Candidatura e histórico parlamentar quando confirmado.' },
  { slug: 'deputado-estadual', eyebrow: 'ASSEMBLEIAS / CLDF', title: 'Deputado Estadual / Distrital', text: 'Consulta leve por UF.' },
];

const REPOSITORY_URL = 'https://github.com/MSsanto/Elei-oes-2026';
const TSE_OPEN_DATA = 'https://dadosabertos.tse.jus.br/';
const TSE_ACCOUNTS_2026 = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/prestacao-de-contas-eleitorais-2026';
const CAMARA_OPEN_DATA = 'https://dadosabertos.camara.leg.br/';

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 .7A11.3 11.3 0 0 0 8.4 22.8c.6.1.8-.2.8-.5v-2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.2c0 .3.2.6.8.5A11.3 11.3 0 0 0 12 .7Z" />
    </svg>
  );
}

function goToSearch(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const cargo = String(data.get('cargo') || '').trim();
  const query = String(data.get('q') || '').trim();
  if (!cargo) return;

  const url = new URL('/', window.location.origin);
  url.searchParams.set('cargo', cargo);
  if (query) url.searchParams.set('q', query);
  window.location.assign(url.toString());
}

function Home() {
  return (
    <div className="project-home">
      <header className="home-site-header">
        <nav className="home-topbar" aria-label="Navegação principal">
          <a className="home-brand" href="/" aria-label="Eleições 2026 — início">
            <span className="home-brand-mark">E26</span>
            <span><strong>Eleições 2026</strong><small>Transparência Eleitoral</small></span>
          </a>
          <div className="home-nav-links">
            <a href="#consultar">Consultar</a>
            <a href="#metodologia">Metodologia</a>
            <a href="#fontes">Fontes</a>
            <a href="#sobre">Sobre</a>
          </div>
          <a className="home-github" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            <GitHubIcon /><span>GitHub</span><span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-content">
          <div className="home-eyebrow">DADOS PÚBLICOS · METODOLOGIA ABERTA · CÓDIGO ABERTO</div>
          <h1 id="home-title">Informação eleitoral <span>sem torcida.</span></h1>
          <p className="home-lead">
            Consulte candidaturas, prestação de contas e, quando a associação entre fontes oficiais for confirmada, histórico de atuação parlamentar.
          </p>

          <form className="home-search" action="/" method="get" onSubmit={goToSearch}>
            <label className="home-search-query">
              <span>Buscar candidato</span>
              <input name="q" type="search" placeholder="Nome ou número" autoComplete="off" />
            </label>
            <label>
              <span>Cargo</span>
              <select name="cargo" defaultValue="" required>
                <option value="" disabled>Escolha o cargo</option>
                {CARGOS.map((cargo) => <option key={cargo.slug} value={cargo.slug}>{cargo.title}</option>)}
              </select>
            </label>
            <button type="submit">Pesquisar <span aria-hidden="true">→</span></button>
          </form>
          <p className="home-search-note">A pesquisa só carrega a base do cargo escolhido.</p>
        </div>
      </section>

      <main>
        <section className="home-cargos" id="consultar" aria-labelledby="consultar-title">
          <div className="home-section-heading compact">
            <span className="home-kicker">CONSULTAR</span>
            <h2 id="consultar-title">Escolha o cargo.</h2>
            <p>Nenhum cargo é priorizado na entrada. A consulta começa pela escolha explícita do usuário.</p>
          </div>
          <div className="home-cargo-grid" aria-label="Cargos disponíveis">
            {CARGOS.map((cargo) => (
              <a key={cargo.slug} className="home-cargo-card" href={`/?cargo=${cargo.slug}`}>
                <span>{cargo.eyebrow}</span>
                <h3>{cargo.title}</h3>
                <p>{cargo.text}</p>
                <strong>Consultar <b aria-hidden="true">→</b></strong>
              </a>
            ))}
          </div>
        </section>

        <section className="home-neutrality" id="sobre" aria-labelledby="neutralidade-title">
          <div className="home-neutrality-mark" aria-hidden="true">≠</div>
          <div>
            <span className="home-kicker">POSICIONAMENTO DO PROJETO</span>
            <h2 id="neutralidade-title">Informativo e sem viés político-partidário.</h2>
            <p>
              Este projeto não apoia, recomenda, classifica ou desfavorece candidaturas, partidos, coligações ou posições políticas. Os mesmos critérios de coleta, exibição e tratamento de ausência de dados são aplicados a todos os registros.
            </p>
            <p>
              Não há ranking de candidatos, notas, selos de “melhor” ou “pior” nem indicação de voto. Quando um dado não é localizado ou uma identidade não pode ser confirmada com segurança, isso é apresentado como ausência de confirmação — não como irregularidade.
            </p>
          </div>
        </section>

        <section className="home-section" aria-labelledby="definicao-title">
          <div className="home-section-heading">
            <span className="home-kicker">O PROJETO</span>
            <h2 id="definicao-title">Dados oficiais organizados para consulta pública.</h2>
            <p>
              A plataforma reúne informações que normalmente ficam distribuídas entre diferentes bases públicas e as apresenta em uma interface única, preservando a origem e o significado dos campos oficiais.
            </p>
          </div>
          <div className="home-principles-grid">
            <article><span>01</span><h3>Fonte identificada</h3><p>A interface informa de onde o dado foi obtido e não substitui o registro mantido pelo órgão responsável.</p></article>
            <article><span>02</span><h3>Critério uniforme</h3><p>Campos e regras de apresentação são aplicados da mesma forma, sem tratamento editorial diferente por candidatura ou partido.</p></article>
            <article><span>03</span><h3>Sem inferência política</h3><p>Valores, categorias e registros são organizados sem serem convertidos em recomendação, ideologia presumida ou juízo de mérito.</p></article>
            <article><span>04</span><h3>Rastreabilidade</h3><p>Coletas, transformações e arquivos processados são versionados; código e metodologia ficam disponíveis no repositório público.</p></article>
          </div>
        </section>

        <section className="home-methodology" id="metodologia" aria-labelledby="metodologia-title">
          <div className="home-section-heading light">
            <span className="home-kicker">METODOLOGIA DE PESQUISA</span>
            <h2 id="metodologia-title">Do dado bruto à consulta.</h2>
            <p>A plataforma prioriza reprodutibilidade, validação e cautela na associação de registros de fontes diferentes.</p>
          </div>
          <div className="home-method-steps">
            <article><strong>1</strong><div><h3>Coleta</h3><p>Arquivos e APIs de órgãos oficiais são consultados por rotinas automatizadas.</p></div></article>
            <article><strong>2</strong><div><h3>Validação</h3><p>A carga é verificada antes da publicação; uma coleta inválida não deve substituir a última base válida.</p></div></article>
            <article><strong>3</strong><div><h3>Vínculo</h3><p>Dados de candidatura e mandato só são associados quando a correspondência atende aos critérios documentados.</p></div></article>
            <article><strong>4</strong><div><h3>Processamento</h3><p>Arquivos grandes são divididos e agregados para reduzir o volume transferido sem alterar categorias oficiais.</p></div></article>
            <article><strong>5</strong><div><h3>Publicação</h3><p>O site registra fonte e data da carga; valores podem mudar quando a fonte oficial é atualizada.</p></div></article>
          </div>
        </section>

        <section className="home-section home-sources" id="fontes" aria-labelledby="fontes-title">
          <div className="home-section-heading">
            <span className="home-kicker">FONTES</span>
            <h2 id="fontes-title">Prioridade para fontes públicas oficiais.</h2>
            <p>Os links abaixo levam às fontes das camadas já integradas ao projeto.</p>
          </div>
          <div className="home-source-grid">
            <a href={TSE_OPEN_DATA} target="_blank" rel="noreferrer"><span>TSE</span><strong>Portal de Dados Abertos</strong><small>Candidaturas e conjuntos eleitorais oficiais ↗</small></a>
            <a href={TSE_ACCOUNTS_2026} target="_blank" rel="noreferrer"><span>TSE</span><strong>Prestação de Contas 2026</strong><small>Receitas e despesas de campanha ↗</small></a>
            <a href={CAMARA_OPEN_DATA} target="_blank" rel="noreferrer"><span>CÂMARA</span><strong>Dados Abertos</strong><small>Mandatos, despesas, proposições e votações ↗</small></a>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer"><span>PROJETO</span><strong>Código e metodologia</strong><small>Histórico público de desenvolvimento ↗</small></a>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div><strong>Eleições 2026 — Transparência Eleitoral</strong><span>Projeto independente, informativo e de código aberto.</span></div>
        <p>O projeto não possui vínculo institucional com o TSE, a Câmara dos Deputados, partidos ou candidaturas. Em caso de divergência, prevalece a informação publicada pela fonte oficial.</p>
      </footer>
    </div>
  );
}

function normalizeEmptySearchParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('q')) return;
  if (String(url.searchParams.get('q') || '').trim()) return;
  url.searchParams.delete('q');
  window.history.replaceState({}, '', url);
}

function renderBootStatus(error = null) {
  const root = document.getElementById('root');
  if (!root) return;
  const cargo = CARGOS.find((item) => item.slug === new URLSearchParams(window.location.search).get('cargo'));
  const title = error ? 'Não foi possível abrir a consulta.' : `Abrindo ${cargo?.title || 'consulta'}…`;
  const detail = error
    ? 'A interface principal não conseguiu iniciar. Tente recarregar a página; se o erro continuar, volte à página inicial.'
    : 'Carregando a interface e a base pública correspondente.';
  root.innerHTML = `
    <div class="project-home">
      <header class="home-site-header"><nav class="home-topbar" aria-label="Navegação principal"><a class="home-brand" href="/"><span class="home-brand-mark">E26</span><span><strong>Eleições 2026</strong><small>Transparência Eleitoral</small></span></a></nav></header>
      <section class="home-hero"><div class="home-hero-content"><div class="home-eyebrow">CONSULTA ELEITORAL</div><h1 style="font-size:clamp(34px,5vw,54px)">${title}</h1><p class="home-lead">${detail}</p>${error ? '<p style="margin-top:22px"><a href="" onclick="window.location.reload();return false" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#2563eb;color:white;text-decoration:none;font-weight:800">Tentar novamente</a> <a href="/" style="display:inline-block;margin-left:10px;color:#dbe5f2">Voltar à home</a></p>' : ''}</div></section>
    </div>`;
}

async function bootConsultation() {
  normalizeEmptySearchParam();
  renderBootStatus();
  try {
    await import('./financeBootstrap.jsx');
  } catch (primaryError) {
    console.error('Falha ao carregar bootstrap completo da consulta.', primaryError);
    try {
      await import('./multiCargoMain.jsx');
    } catch (fallbackError) {
      console.error('Falha também no bootstrap mínimo da consulta.', fallbackError);
      renderBootStatus(fallbackError);
    }
  }
}

const params = new URLSearchParams(window.location.search);
const knownCargo = CARGOS.some((cargo) => cargo.slug === params.get('cargo'));
const legacyCandidateLink = Boolean(params.get('candidato'));

if (knownCargo || legacyCandidateLink) {
  bootConsultation();
} else {
  createRoot(document.getElementById('root')).render(<React.StrictMode><Home /></React.StrictMode>);
}
