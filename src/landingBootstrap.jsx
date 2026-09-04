import React from 'react';
import { createRoot } from 'react-dom/client';
import './home.css';

const CARGOS = [
  {
    slug: 'presidente',
    eyebrow: 'BRASIL',
    title: 'Presidente',
    text: 'Consulte candidaturas à Presidência da República e os dados oficiais já integrados ao projeto.',
  },
  {
    slug: 'governador',
    eyebrow: 'POR UF',
    title: 'Governador',
    text: 'Escolha um estado e consulte as candidaturas ao governo com carregamento direcionado por UF.',
  },
  {
    slug: 'senador',
    eyebrow: 'POR UF',
    title: 'Senador',
    text: 'Consulte candidaturas ao Senado Federal a partir da unidade da Federação selecionada.',
  },
  {
    slug: 'deputado-federal',
    eyebrow: 'CÂMARA DOS DEPUTADOS',
    title: 'Deputado Federal',
    text: 'Além da candidatura, o projeto pode vincular histórico parlamentar quando a correspondência nas fontes oficiais é confirmada.',
  },
  {
    slug: 'deputado-estadual',
    eyebrow: 'ASSEMBLEIAS / CLDF',
    title: 'Deputado Estadual / Distrital',
    text: 'Consulta otimizada por UF, com carregamento em partes para preservar a velocidade mesmo diante do grande volume de candidaturas.',
  },
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

function Home() {
  return (
    <div className="project-home">
      <header className="home-hero">
        <nav className="home-topbar" aria-label="Navegação principal">
          <a className="home-brand" href="/" aria-label="Eleições 2026 — início">
            <span className="home-brand-mark">E26</span>
            <span><strong>Eleições 2026</strong><small>Transparência Eleitoral</small></span>
          </a>
          <a className="home-github" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            <GitHubIcon /><span>GitHub</span><span aria-hidden="true">↗</span>
          </a>
        </nav>

        <div className="home-hero-content">
          <div className="home-eyebrow">DADOS PÚBLICOS · METODOLOGIA ABERTA · CÓDIGO ABERTO</div>
          <h1>Informação eleitoral<br /><span>sem torcida.</span></h1>
          <p className="home-lead">
            O Eleições 2026 é um projeto independente de transparência que organiza dados públicos oficiais para facilitar a consulta de candidaturas, prestação de contas e, quando disponível e corretamente vinculado, histórico de atuação parlamentar.
          </p>
          <a className="home-primary-action" href="#consultar">Escolher um cargo <span aria-hidden="true">↓</span></a>
        </div>
      </header>

      <main>
        <section className="home-neutrality" aria-labelledby="neutralidade-title">
          <div className="home-neutrality-mark" aria-hidden="true">≠</div>
          <div>
            <span className="home-kicker">POSICIONAMENTO DO PROJETO</span>
            <h2 id="neutralidade-title">Sem viés político-partidário.</h2>
            <p>
              Este projeto não apoia, recomenda, classifica ou desfavorece candidaturas, partidos, coligações ou posições políticas. A proposta é exclusivamente informativa: apresentar dados públicos com critérios uniformes, fonte identificada e possibilidade de auditoria.
            </p>
            <p>
              Não há notas, selos de “melhor” ou “pior”, ranking de candidatos nem interpretação sobre em quem o eleitor deve votar. Quando um dado não é localizado ou uma identidade não pode ser confirmada com segurança, isso é informado como ausência de confirmação — e não como irregularidade.
            </p>
          </div>
        </section>

        <section className="home-section" aria-labelledby="definicao-title">
          <div className="home-section-heading">
            <span className="home-kicker">O QUE É</span>
            <h2 id="definicao-title">Um ponto de consulta para dados que normalmente estão espalhados.</h2>
            <p>
              A plataforma reúne, processa e apresenta informações de fontes públicas oficiais em uma interface única, preservando a distinção entre o que foi publicado pela fonte e o que foi apenas organizado pelo projeto.
            </p>
          </div>
          <div className="home-principles-grid">
            <article><span>01</span><h3>Fonte antes da interface</h3><p>Dados exibidos devem ter origem pública identificável. A interface não substitui o registro oficial e informa de onde a informação foi obtida.</p></article>
            <article><span>02</span><h3>Mesmo critério para todos</h3><p>Campos, regras de exibição e tratamento de ausência de dados são aplicados de forma uniforme, sem favorecer candidaturas ou partidos.</p></article>
            <article><span>03</span><h3>Sem inferência política</h3><p>O projeto organiza valores, categorias, registros e históricos. Não transforma esses dados em nota, recomendação, ideologia presumida ou juízo de mérito.</p></article>
            <article><span>04</span><h3>Rastreabilidade</h3><p>Coletas, transformações e arquivos processados são versionados. A metodologia e o código podem ser inspecionados no repositório público.</p></article>
          </div>
        </section>

        <section className="home-methodology" aria-labelledby="metodologia-title">
          <div className="home-section-heading light">
            <span className="home-kicker">METODOLOGIA DE PESQUISA</span>
            <h2 id="metodologia-title">Do dado bruto à consulta pública.</h2>
            <p>A plataforma prioriza reprodutibilidade e cautela na associação de registros provenientes de bases diferentes.</p>
          </div>
          <div className="home-method-steps">
            <article><strong>1</strong><div><h3>Coleta</h3><p>Arquivos e APIs de órgãos oficiais são consultados por rotinas automatizadas. Entre as fontes atualmente integradas estão o Tribunal Superior Eleitoral e os Dados Abertos da Câmara dos Deputados.</p></div></article>
            <article><strong>2</strong><div><h3>Validação</h3><p>A carga é verificada antes da publicação. Downloads inválidos ou processamento incompleto não devem substituir a última base considerada válida.</p></div></article>
            <article><strong>3</strong><div><h3>Vínculo entre fontes</h3><p>Dados de candidatura e de mandato só são associados quando há correspondência suficiente segundo os critérios documentados. Em casos ambíguos, o projeto prefere não vincular a arriscar uma identificação incorreta.</p></div></article>
            <article><strong>4</strong><div><h3>Processamento</h3><p>Grandes arquivos são transformados em estruturas menores, sem alterar o significado das categorias oficiais. Isso reduz o volume transferido ao navegador e mantém a navegação leve.</p></div></article>
            <article><strong>5</strong><div><h3>Publicação</h3><p>O site apresenta os dados com contexto, data de carga e indicação de fonte. Valores financeiros e históricos podem mudar quando os órgãos oficiais publicam novas informações.</p></div></article>
          </div>
        </section>

        <section className="home-section home-sources" aria-labelledby="fontes-title">
          <div className="home-section-heading">
            <span className="home-kicker">FONTES</span>
            <h2 id="fontes-title">Prioridade para fontes públicas oficiais.</h2>
            <p>Os links abaixo levam às fontes que sustentam as camadas já integradas ao projeto.</p>
          </div>
          <div className="home-source-grid">
            <a href={TSE_OPEN_DATA} target="_blank" rel="noreferrer"><span>TSE</span><strong>Portal de Dados Abertos</strong><small>Candidaturas e conjuntos eleitorais oficiais ↗</small></a>
            <a href={TSE_ACCOUNTS_2026} target="_blank" rel="noreferrer"><span>TSE</span><strong>Prestação de Contas 2026</strong><small>Receitas, despesas e arquivos de campanha ↗</small></a>
            <a href={CAMARA_OPEN_DATA} target="_blank" rel="noreferrer"><span>CÂMARA</span><strong>Dados Abertos</strong><small>Mandatos, despesas, proposições e votações ↗</small></a>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer"><span>PROJETO</span><strong>Código e metodologia</strong><small>Histórico público de desenvolvimento ↗</small></a>
          </div>
        </section>

        <section className="home-cargos" id="consultar" aria-labelledby="consultar-title">
          <div className="home-section-heading light">
            <span className="home-kicker">CONSULTAR</span>
            <h2 id="consultar-title">Escolha o cargo.</h2>
            <p>Nenhum cargo é priorizado na entrada do site. A consulta começa pela sua escolha explícita.</p>
          </div>
          <div className="home-cargo-grid">
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
      </main>

      <footer className="home-footer">
        <div><strong>Eleições 2026 — Transparência Eleitoral</strong><span>Projeto independente, informativo e de código aberto.</span></div>
        <p>O projeto não possui vínculo institucional com o TSE, a Câmara dos Deputados, partidos ou candidaturas. Em caso de divergência, prevalece a informação publicada pela fonte oficial.</p>
      </footer>
    </div>
  );
}

const params = new URLSearchParams(window.location.search);
const knownCargo = CARGOS.some((cargo) => cargo.slug === params.get('cargo'));
const legacyCandidateLink = Boolean(params.get('candidato'));

if (knownCargo || legacyCandidateLink) {
  import('./financeBootstrap.jsx');
} else {
  createRoot(document.getElementById('root')).render(<React.StrictMode><Home /></React.StrictMode>);
}
