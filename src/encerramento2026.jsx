import React, { useEffect } from 'react';
import PlatformHeader from './PlatformHeader.jsx';
import './encerramento2026.css';

const REPO = 'https://github.com/MSsanto/Elei-oes-2026';

const ENTREGAS = [
  {
    numero: '01',
    titulo: 'Consulta de candidaturas',
    texto: 'Pesquisa por nome, número, cargo e unidade da Federação, com filtros, ordenação neutra, perfis individuais e navegação acessível para os cinco cargos das eleições gerais.',
    link: '/?cargo=deputado-federal',
    acao: 'Explorar candidaturas',
  },
  {
    numero: '02',
    titulo: 'Contas de campanha',
    texto: 'Receitas, despesas, categorias oficiais, fornecedores e a área Siga o Dinheiro para explorar registros sem atribuir notas, suspeitas ou julgamentos a candidatos.',
    link: '/siga-o-dinheiro',
    acao: 'Ver dados financeiros',
  },
  {
    numero: '03',
    titulo: 'Patrimônio e histórico',
    texto: 'Bens declarados à Justiça Eleitoral e histórico 2022–2026 somente quando a identificação entre as duas eleições é conservadora e comprovável.',
    link: `${REPO}/blob/main/docs/HISTORICO_PATRIMONIAL.md`,
    acao: 'Ler a metodologia',
    externo: true,
  },
  {
    numero: '04',
    titulo: 'Radar e educação cívica',
    texto: 'Mudanças identificadas entre cargas comparáveis, panorama eleitoral e explicações para ajudar a interpretar os dados publicados.',
    link: '/entenda',
    acao: 'Visitar Entenda',
  },
  {
    numero: '05',
    titulo: 'Transparência da engenharia',
    texto: 'Código aberto, documentação das fontes e critérios, pipelines verificáveis, publicação no Cloudflare Pages e histórico de mudanças no GitHub.',
    link: `${REPO}/blob/main/docs/BACKLOG.md`,
    acao: 'Ver entregas documentadas',
    externo: true,
  },
];

const MARCOS = [
  { data: '2026', titulo: 'Construção e publicação', detalhe: 'Consulta eleitoral, perfis, finanças, patrimônio, Radar, Siga o Dinheiro e páginas editoriais.' },
  { data: '05/09', titulo: 'Carga patrimonial documentada', detalhe: '13.843 candidaturas com dados patrimoniais, 76.806 bens e 4.019 vínculos históricos conservadores.' },
  { data: '22/10', titulo: 'Coletas recorrentes suspensas', detalhe: 'Pipelines periódicos e watchdog congelados, mantendo rotas manuais e histórico versionado.' },
  { data: '26/10', titulo: 'Consolidação eleitoral final', detalhe: 'Totalização oficial de 1.654 eleitas e eleitos consolidada a partir de 116 arquivos TSE. Publicação no domínio depende de verificação independente.' },
];

export default function Encerramento2026() {
  useEffect(() => {
    document.title = 'Projeto 2026 concluído | Transparência Eleitoral';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = 'Conheça as entregas, a metodologia e o encerramento do ciclo 2026 do projeto independente Transparência Eleitoral.';
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}/encerramento-2026`;
  }, []);

  return (
    <div className="info-page closure-page">
      <PlatformHeader current="encerramento" />
      <main className="closure-main">
        <nav className="closure-breadcrumb" aria-label="Caminho da página">
          <a href="/">Início</a><span aria-hidden="true">/</span><span>Encerramento 2026</span>
        </nav>

        <header className="closure-hero">
          <span className="closure-kicker">ENCERRAMENTO DO CICLO · 2026</span>
          <h1>O projeto Eleições 2026 foi concluído.</h1>
          <p>Deixamos como registro público o que construímos, as fontes consultadas e os critérios utilizados. A plataforma permanece disponível como arquivo histórico do ciclo eleitoral, sem novas coletas automáticas.</p>
          <div className="closure-actions">
            <a className="closure-primary" href="#entregas">Conheça as entregas <span aria-hidden="true">↓</span></a>
            <a className="closure-secondary" href={REPO} target="_blank" rel="noreferrer">Código e histórico no GitHub ↗</a>
          </div>
          <p className="closure-caution"><strong>Nota de integridade:</strong> a suspensão das atualizações periódicas foi registrada em 22/10/2026. O resultado oficial do segundo turno foi confirmado em 26/10 e o snapshot arquivado contém 1.654 eleitas e eleitos. O registro no GitHub não comprova, por si só, que a nova versão foi publicada no Cloudflare Pages.</p>
        </header>

        <section className="closure-section" aria-labelledby="numeros-title">
          <div className="closure-heading"><span className="closure-kicker">O ALCANCE DO TRABALHO</span><h2 id="numeros-title">Entregas verificáveis.</h2><p>Indicadores extraídos das cargas e da documentação publicadas durante o desenvolvimento, não uma contagem de votos ou de resultados eleitorais.</p></div>
          <div className="closure-metrics">
            <article><strong>19.991</strong><span>candidaturas na malha editorial documentada</span></article>
            <article><strong>1.828</strong><span>páginas agregadoras por cargo, UF e partido</span></article>
            <article><strong>76.806</strong><span>registros de bens na primeira carga patrimonial</span></article>
            <article><strong>4.019</strong><span>vínculos históricos 2022–2026 confirmados</span></article>\n            <article><strong>1.654</strong><span>eleitas e eleitos no snapshot oficial do TSE</span></article>
          </div>
          <p className="closure-source">Referências: <a href={`${REPO}/blob/main/docs/BACKLOG.md`} target="_blank" rel="noreferrer">backlog e PRs de entrega ↗</a> · <a href={`${REPO}/blob/main/docs/PATRIMONIO_FONTES.md`} target="_blank" rel="noreferrer">metodologia patrimonial ↗</a>.</p>
        </section>

        <section className="closure-section" id="entregas" aria-labelledby="entregas-title">
          <div className="closure-heading"><span className="closure-kicker">O QUE FIZEMOS</span><h2 id="entregas-title">Uma plataforma pública, do dado bruto à consulta.</h2><p>O projeto foi construído para oferecer uma leitura rastreável dos registros oficiais, sem recomendar candidaturas ou atribuir juízos políticos.</p></div>
          <div className="closure-deliveries">
            {ENTREGAS.map((item) => (
              <article key={item.numero}>
                <span className="closure-number" aria-hidden="true">{item.numero}</span>
                <div><h3>{item.titulo}</h3><p>{item.texto}</p><a href={item.link} target={item.externo ? '_blank' : undefined} rel={item.externo ? 'noreferrer' : undefined}>{item.acao} <span aria-hidden="true">↗</span></a></div>
              </article>
            ))}
          </div>
        </section>

        <section className="closure-section" aria-labelledby="linha-title">
          <div className="closure-heading"><span className="closure-kicker">LINHA DO TEMPO</span><h2 id="linha-title">Do desenvolvimento ao arquivo histórico.</h2></div>
          <ol className="closure-timeline">
            {MARCOS.map((marco) => <li key={marco.data}><span>{marco.data}</span><div><h3>{marco.titulo}</h3><p>{marco.detalhe}</p></div></li>)}
          </ol>
        </section>

        <section className="closure-last" aria-labelledby="futuro-title">
          <span className="closure-kicker">COMPROMISSO COM A TRANSPARÊNCIA</span>
          <h2 id="futuro-title">O trabalho termina. O registro permanece.</h2>
          <p>O site não é uma fonte oficial de resultado eleitoral. Os dados exibidos pertencem aos respectivos órgãos públicos e devem ser confrontados com os registros originais. Informações ausentes ou desatualizadas não são prova de irregularidade.</p>
          <p>Novas funcionalidades, acompanhamento de mandatos ou outro ciclo eleitoral não estão incluídos nesta versão encerrada. Uma eventual retomada será decidida e documentada separadamente.</p>
          <div className="closure-links">
            <a href="/fontes">Fontes oficiais</a>
            <a href="/metodologia">Metodologia</a>
            <a href={`${REPO}/blob/main/docs/ENCERRAMENTO_2026.md`} target="_blank" rel="noreferrer">Documento de encerramento ↗</a>
          </div>
          <small>Projeto independente, sem vínculo institucional com o TSE, partidos, campanhas ou candidaturas.</small>
        </section>
      </main>
    </div>
  );
}
