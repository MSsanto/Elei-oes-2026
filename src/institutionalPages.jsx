import React, { useEffect } from 'react';
import PlatformHeader from './PlatformHeader.jsx';

const TSE_CANDIDATES = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026';
const TSE_ACCOUNTS = 'https://dadosabertos.tse.jus.br/pt_BR/dataset/prestacao-de-contas-eleitorais-2026';
const TSE_HOME = 'https://dadosabertos.tse.jus.br/';
const CAMARA = 'https://dadosabertos.camara.leg.br/';
const REPOSITORY = 'https://github.com/MSsanto/Elei-oes-2026';
const PROCESSED = `${REPOSITORY}/tree/main/data/processed`;

const PAGE_COPY = {
  metodologia: {
    kicker: 'METODOLOGIA',
    title: 'Como os dados são coletados, tratados e publicados.',
    lead: 'A plataforma organiza bases públicas oficiais para consulta. O objetivo é preservar a rastreabilidade do dado, aplicar os mesmos critérios a todos os registros e separar informação publicada de qualquer interpretação editorial.',
  },
  fontes: {
    kicker: 'FONTES',
    title: 'De onde vêm os dados exibidos.',
    lead: 'Cada camada da plataforma identifica sua origem. Quando há divergência entre a interface e a fonte responsável pelo registro, prevalece a informação publicada pelo órgão oficial.',
  },
  sobre: {
    kicker: 'SOBRE O PROJETO',
    title: 'Uma ferramenta independente de consulta eleitoral.',
    lead: 'Eleições 2026 — Transparência Eleitoral é um projeto informativo e de código aberto. Não apoia, recomenda, classifica ou desfavorece candidaturas, partidos, coligações ou posições políticas.',
  },
};

function setPageMeta(kind) {
  const copy = PAGE_COPY[kind];
  document.title = `${copy.kicker[0] + copy.kicker.slice(1).toLowerCase()} | Eleições 2026`;
  let description = document.querySelector('meta[name="description"]');
  if (!description) {
    description = document.createElement('meta');
    description.name = 'description';
    document.head.appendChild(description);
  }
  description.content = copy.lead;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = `${window.location.origin}/${kind}`;
}

function Methodology() {
  return (
    <>
      <section className="info-section">
        <h2>Fluxo de publicação</h2>
        <h3>1. Coleta</h3>
        <p>Rotinas automatizadas consultam arquivos e APIs das fontes identificadas pelo projeto. A plataforma não substitui os registros mantidos pelos órgãos responsáveis.</p>
        <h3>2. Validação</h3>
        <p>Antes da publicação, a carga é verificada. Uma coleta inválida ou incompleta não deve substituir automaticamente a última base válida.</p>
        <h3>3. Associação entre fontes</h3>
        <p>Dados eleitorais e parlamentares só são vinculados quando a correspondência atende aos critérios documentados. Quando não há confirmação suficiente, a ausência de vínculo é apresentada como tal e não como irregularidade.</p>
        <h3>4. Processamento</h3>
        <p>Conjuntos grandes podem ser divididos, indexados ou agregados para reduzir transferência e tempo de carregamento. A interface preserva o significado dos campos usados na fonte.</p>
        <h3>5. Publicação e atualização</h3>
        <p>A data exibida na plataforma identifica a carga processada pelo projeto. Registros podem mudar quando as fontes oficiais forem atualizadas.</p>
      </section>
      <section className="info-section">
        <h2>Critérios editoriais</h2>
        <ul>
          <li>Os mesmos campos, filtros e regras de apresentação são aplicados a todas as candidaturas.</li>
          <li>Não há ranking, nota, selo de melhor ou pior, recomendação ou indicação de voto.</li>
          <li>Valores financeiros são apresentados de forma descritiva, sem transformar montantes em juízo de mérito.</li>
          <li>Ausência de dado, vínculo ou confirmação não é apresentada como indício de irregularidade.</li>
          <li>O código e os arquivos processados ficam disponíveis para auditoria técnica quando a camada permite.</li>
        </ul>
      </section>
      <section className="info-section">
        <h2>Reprodutibilidade</h2>
        <p>O repositório público registra o código usado para coleta, transformação, interface e validações. Metadados de carga e, quando disponíveis, hashes dos arquivos ajudam a conferir qual conteúdo foi processado.</p>
        <div className="info-links"><a href={REPOSITORY} target="_blank" rel="noreferrer">Abrir código e documentação ↗</a><a href={PROCESSED} target="_blank" rel="noreferrer">Ver dados processados ↗</a></div>
      </section>
    </>
  );
}

function Sources() {
  return (
    <>
      <section className="info-section">
        <h2>Fontes eleitorais</h2>
        <p>As camadas de candidaturas e prestação de contas apontam para os conjuntos oficiais correspondentes no Portal de Dados Abertos do Tribunal Superior Eleitoral.</p>
        <div className="info-links">
          <a href={TSE_HOME} target="_blank" rel="noreferrer">Portal de Dados Abertos — TSE ↗</a>
          <a href={TSE_CANDIDATES} target="_blank" rel="noreferrer">Candidatos 2026 — TSE ↗</a>
          <a href={TSE_ACCOUNTS} target="_blank" rel="noreferrer">Prestação de Contas Eleitorais 2026 — TSE ↗</a>
        </div>
      </section>
      <section className="info-section">
        <h2>Atuação parlamentar</h2>
        <p>Quando a correspondência de identidade é confirmada pelos critérios do projeto, a plataforma pode associar a candidatura a registros publicados pelos Dados Abertos da Câmara dos Deputados.</p>
        <div className="info-links"><a href={CAMARA} target="_blank" rel="noreferrer">Dados Abertos — Câmara dos Deputados ↗</a></div>
      </section>
      <section className="info-section">
        <h2>Camada processada</h2>
        <p>Para desempenho, parte das fontes é transformada em arquivos menores de consulta. A origem continua indicada, e o repositório permite inspecionar a estrutura processada usada pelo site.</p>
        <div className="info-links"><a href={PROCESSED} target="_blank" rel="noreferrer">Arquivos processados no GitHub ↗</a></div>
      </section>
    </>
  );
}

function About() {
  return (
    <>
      <section className="info-section">
        <h2>O que a plataforma faz</h2>
        <p>Reúne informações públicas que normalmente ficam distribuídas entre diferentes bases e as apresenta em uma experiência única de pesquisa, filtro e leitura de perfil.</p>
      </section>
      <section className="info-section">
        <h2>O que a plataforma não faz</h2>
        <p>Não recomenda candidaturas, não produz ranking eleitoral, não atribui pontuação e não interpreta ausência de informação como irregularidade. Partido e candidatura não determinam cor, posição ou destaque de card.</p>
      </section>
      <section className="info-section">
        <h2>Independência</h2>
        <p>O projeto não possui vínculo institucional com o TSE, a Câmara dos Deputados, partidos ou candidaturas. Links diretos para as fontes oficiais são mantidos para facilitar conferência e contextualização.</p>
        <div className="info-links"><a href={REPOSITORY} target="_blank" rel="noreferrer">Repositório público ↗</a><a href="/metodologia">Ler metodologia</a><a href="/fontes">Consultar fontes</a></div>
      </section>
    </>
  );
}

export default function InstitutionalPage({ kind }) {
  const safeKind = PAGE_COPY[kind] ? kind : 'sobre';
  const copy = PAGE_COPY[safeKind];
  useEffect(() => setPageMeta(safeKind), [safeKind]);
  return (
    <div className="info-page">
      <PlatformHeader current={safeKind} />
      <main className="info-main">
        <div className="info-breadcrumb"><a href="/">Início</a> <span aria-hidden="true">›</span> {copy.kicker[0] + copy.kicker.slice(1).toLowerCase()}</div>
        <span className="info-kicker">{copy.kicker}</span>
        <h1>{copy.title}</h1>
        <p className="info-lead">{copy.lead}</p>
        {safeKind === 'metodologia' && <Methodology />}
        {safeKind === 'fontes' && <Sources />}
        {safeKind === 'sobre' && <About />}
      </main>
    </div>
  );
}
