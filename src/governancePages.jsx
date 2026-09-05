import React, { useEffect } from 'react';
import PlatformHeader from './PlatformHeader.jsx';

const REPOSITORY = 'https://github.com/MSsanto/Elei-oes-2026';
const CORRECTIONS_DOC = `${REPOSITORY}/blob/main/docs/CORRECOES.md`;
const STATUS_DOC = `${REPOSITORY}/blob/main/docs/SITUACAO_CANDIDATURA.md`;
const TSE = 'https://dadosabertos.tse.jus.br/';
const DIVULGACAND = 'https://divulgacandcontas.tse.jus.br/divulga/';

const COPY = {
  expediente: {
    kicker: 'EXPEDIENTE',
    title: 'Quem mantém o projeto e quais regras orientam a publicação.',
    lead: 'Eleições 2026 — Transparência Eleitoral é um projeto independente e de código aberto que organiza dados públicos oficiais para consulta factual, com metodologia, fontes e histórico de alterações identificáveis.',
  },
  correcoes: {
    kicker: 'CORREÇÕES E RETIFICAÇÕES',
    title: 'Como erros do projeto são corrigidos e registrados.',
    lead: 'Correções relevantes são tratadas de forma rastreável e versionada. Atualizações ordinárias feitas pela própria fonte oficial são diferenciadas de erros de coleta, processamento, associação ou apresentação do projeto.',
  },
  situacao: {
    kicker: 'SITUAÇÃO DA CANDIDATURA',
    title: 'Como a situação oficial do registro é apresentada.',
    lead: 'A plataforma reproduz a situação publicada pela Justiça Eleitoral, sem criar um rótulo próprio de aptidão, mérito ou recomendação e sem retirar da consulta candidaturas indeferidas, sob recurso, canceladas ou com outras situações oficiais.',
  },
};

function setMeta(kind) {
  const copy = COPY[kind];
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
  const path = kind === 'situacao' ? 'situacao-candidatura' : kind;
  canonical.href = `${window.location.origin}/${path}`;
}

function GovernanceLinks() {
  return (
    <div className="info-links">
      <a href="/sobre">Sobre o projeto</a>
      <a href="/metodologia">Metodologia</a>
      <a href="/fontes">Fontes</a>
      <a href="/expediente">Expediente</a>
      <a href="/correcoes">Correções</a>
      <a href="/situacao-candidatura">Situação da candidatura</a>
    </div>
  );
}

function Expediente() {
  return (
    <>
      <section className="info-section">
        <h2>Identidade e independência</h2>
        <p>O projeto é mantido de forma independente no repositório público <strong>MSsanto/Elei-oes-2026</strong>. Não possui vínculo institucional com o TSE, Câmara dos Deputados, partidos, candidaturas ou campanhas.</p>
        <p>A missão editorial é organizar informações públicas, preservar a rastreabilidade das fontes e aplicar os mesmos critérios de apresentação a todos os registros.</p>
      </section>
      <section className="info-section">
        <h2>Responsabilidades editoriais</h2>
        <ul>
          <li>não recomendar voto, classificar ou atribuir pontuação a candidaturas;</li>
          <li>não transformar ausência de informação em suspeita ou irregularidade;</li>
          <li>identificar fonte e data de carga sempre que a camada permitir;</li>
          <li>registrar correções relevantes de forma versionada;</li>
          <li>distinguir atualização da fonte oficial de erro cometido pelo projeto.</li>
        </ul>
      </section>
      <section className="info-section">
        <h2>Governança pública</h2>
        <p>Metodologia, código, dados processados e documentação ficam disponíveis para auditoria técnica. A política de correções define como falhas do projeto são registradas. A política de situação da candidatura explica como decisões e estados processuais da Justiça Eleitoral entram na plataforma.</p>
        <GovernanceLinks />
        <div className="info-links"><a href={REPOSITORY} target="_blank" rel="noreferrer">Repositório público ↗</a></div>
      </section>
    </>
  );
}

function Corrections() {
  return (
    <>
      <section className="info-section">
        <h2>Quando há uma correção</h2>
        <p>Há correção quando o projeto exibe ou associa uma informação de maneira diferente da fonte utilizada naquela carga, ou quando um erro de processamento, texto ou interface altera o significado público do dado.</p>
        <p>Quando o próprio órgão oficial modifica um registro posteriormente, isso é tratado como atualização da fonte — não como erro automático da plataforma.</p>
      </section>
      <section className="info-section">
        <h2>Registro mínimo</h2>
        <p>Correções relevantes registram data, conteúdo afetado, motivo, fonte de conferência, commit/versão e efeito da mudança. O histórico não é apagado silenciosamente.</p>
        <div className="info-links"><a href={CORRECTIONS_DOC} target="_blank" rel="noreferrer">Política e registro versionado ↗</a></div>
      </section>
      <section className="info-section">
        <h2>Mesmo critério para todos</h2>
        <p>A política é aplicada independentemente da pessoa, partido, cargo ou posição política envolvida. Uma correção descreve o erro do projeto e não atribui culpa ou irregularidade a uma candidatura.</p>
        <GovernanceLinks />
      </section>
    </>
  );
}

function CandidateStatus() {
  return (
    <>
      <section className="info-section">
        <h2>O que aparece no perfil</h2>
        <p>Quando a Justiça Eleitoral publica uma situação legível, o texto é reproduzido como campo factual. A plataforma não converte situações processuais em uma avaliação própria.</p>
        <p>Candidaturas continuam disponíveis na pesquisa mesmo quando a fonte oficial publica indeferimento, recurso, cancelamento, pedido não conhecido ou outra situação.</p>
      </section>
      <section className="info-section">
        <h2>Atualização e recurso</h2>
        <p>A situação de um registro pode mudar conforme julgamento, recurso ou nova carga da Justiça Eleitoral. Por isso, a interface apresenta o retrato da última carga válida processada e não presume o desfecho de processo pendente.</p>
      </section>
      <section className="info-section">
        <h2>Fontes e fallback</h2>
        <p>O arquivo oficial de candidaturas do TSE é a base estrutural. Quando ele contém marcador técnico sem descrição humana, o projeto tenta complementar o campo com a descrição publicada no DivulgaCandContas. Se a coleta complementar falhar, a última situação válida é preservada; sem informação legível, nenhuma conclusão é inferida.</p>
        <div className="info-links">
          <a href={TSE} target="_blank" rel="noreferrer">Dados Abertos — TSE ↗</a>
          <a href={DIVULGACAND} target="_blank" rel="noreferrer">DivulgaCandContas — TSE ↗</a>
          <a href={STATUS_DOC} target="_blank" rel="noreferrer">Metodologia técnica do status ↗</a>
        </div>
        <GovernanceLinks />
      </section>
    </>
  );
}

export default function GovernancePage({ kind }) {
  const safeKind = COPY[kind] ? kind : 'expediente';
  const copy = COPY[safeKind];
  useEffect(() => setMeta(safeKind), [safeKind]);
  return (
    <div className="info-page">
      <PlatformHeader current="expediente" />
      <main className="info-main">
        <div className="info-breadcrumb"><a href="/">Início</a> <span aria-hidden="true">›</span> {copy.kicker[0] + copy.kicker.slice(1).toLowerCase()}</div>
        <span className="info-kicker">{copy.kicker}</span>
        <h1>{copy.title}</h1>
        <p className="info-lead">{copy.lead}</p>
        {safeKind === 'expediente' && <Expediente />}
        {safeKind === 'correcoes' && <Corrections />}
        {safeKind === 'situacao' && <CandidateStatus />}
      </main>
    </div>
  );
}
