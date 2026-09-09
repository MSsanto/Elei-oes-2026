import React, { useEffect } from 'react';
import PlatformHeader from './PlatformHeader.jsx';
import { ELECTION_2026, ELECTORATE_BY_UF, OFFICIAL_SOURCES, formatInteger } from './election2026Facts.js';
import './civicEducation.css';

const EDITORIALS = [
  {
    id: 'quociente-eleitoral',
    kicker: 'SISTEMA PROPORCIONAL',
    title: 'Você sabe o que é quociente eleitoral?',
    lead: 'Para deputado federal, estadual, distrital e vereador, não basta olhar apenas para a votação individual de cada candidato.',
    paragraphs: [
      'O quociente eleitoral (QE) é obtido pela divisão do total de votos válidos pelo número de vagas em disputa naquela circunscrição. Ele é uma das bases usadas para transformar os votos de partidos e federações em cadeiras nas eleições proporcionais.',
      'Isso significa que o desempenho do partido ou da federação também importa. Depois da distribuição das vagas entre as legendas, entram as regras de votação nominal e de distribuição das sobras. Por isso, a lista dos candidatos individualmente mais votados não é, sozinha, a lista dos eleitos.',
      'Votos brancos e nulos não integram os votos válidos e, portanto, não entram no cálculo do quociente eleitoral.',
    ],
    facts: ['QE = votos válidos ÷ número de vagas', 'Usado nas eleições proporcionais', 'O voto no partido/federação influencia a distribuição de cadeiras'],
    source: OFFICIAL_SOURCES.quotient,
    sourceLabel: 'TSE — sistemas majoritário e proporcional',
  },
  {
    id: 'brancos-e-nulos',
    kicker: 'SEU VOTO',
    title: 'Você sabe a diferença entre votos brancos e votos nulos?',
    lead: 'Os dois expressam que o eleitor não atribuiu seu voto a uma candidatura válida, mas são registrados de formas diferentes na urna.',
    paragraphs: [
      'O voto em branco é registrado quando a pessoa pressiona a tecla “Branco” e confirma. O voto nulo ocorre quando é digitado e confirmado um número que não corresponde a uma candidatura válida para aquele cargo.',
      'Para o resultado eleitoral, ambos ficam fora da contagem de votos válidos. Eles não são transferidos para quem está na frente, não entram no quociente eleitoral e não anulam uma eleição, ainda que somados atinjam mais de 50% dos votos.',
    ],
    facts: ['Branco: tecla “Branco” + confirmação', 'Nulo: número inválido + confirmação', 'Nenhum dos dois é voto válido'],
    source: OFFICIAL_SOURCES.blankNull,
    sourceLabel: 'TSE — voto branco x voto nulo',
  },
  {
    id: 'camara-e-senado',
    kicker: 'CONGRESSO NACIONAL',
    title: 'Quantos são e como são divididos os deputados federais e senadores?',
    lead: 'Câmara e Senado formam o Congresso Nacional, mas representam o país de maneiras diferentes.',
    paragraphs: [
      `A Câmara dos Deputados tem ${formatInteger(ELECTION_2026.federalDeputySeats)} cadeiras. Cada unidade da Federação possui entre 8 e 70 deputados, em distribuição vinculada à população. Em 2026, todas as 513 vagas estão em disputa.`,
      `O Senado tem ${formatInteger(ELECTION_2026.senateSeats)} cadeiras: exatamente três para cada estado e três para o Distrito Federal. Os mandatos duram oito anos e a renovação alterna um terço e dois terços. Em 2026, serão eleitos dois senadores por unidade da Federação, totalizando ${formatInteger(ELECTION_2026.senateSeatsContested2026)} vagas.`,
    ],
    facts: ['Câmara: 513 cadeiras e mandato de 4 anos', 'Senado: 81 cadeiras e mandato de 8 anos', 'Em 2026: 513 deputados federais e 54 senadores serão eleitos'],
    sources: [
      [OFFICIAL_SOURCES.federalSeats2026, 'Câmara — 513 vagas em 2026'],
      [OFFICIAL_SOURCES.senate2026, 'Senado — 54 vagas em 2026'],
    ],
  },
  {
    id: 'ser-governador',
    kicker: 'ELEGIBILIDADE',
    title: 'Você sabe o que é preciso para ser governador?',
    lead: 'A Constituição e a legislação eleitoral estabelecem condições mínimas para que alguém possa disputar o governo de um estado ou do Distrito Federal.',
    paragraphs: [
      'É necessário ter nacionalidade brasileira, estar no pleno exercício dos direitos políticos, possuir alistamento eleitoral, domicílio eleitoral na circunscrição e filiação partidária, além de não incidir em causa de inelegibilidade.',
      'Para governador e vice-governador, a idade mínima é de 30 anos. Para cargos do Poder Executivo, a idade mínima é aferida na data da posse.',
      'A eleição para governador usa o sistema majoritário. Para vencer no primeiro turno, a candidatura precisa alcançar a maioria absoluta dos votos válidos; se isso não ocorrer, os dois mais votados disputam o segundo turno.',
    ],
    facts: ['Idade mínima: 30 anos na posse', 'Domicílio eleitoral e filiação partidária são exigidos', 'Não pode existir causa legal de inelegibilidade'],
    source: OFFICIAL_SOURCES.eligibility,
    sourceLabel: 'TSE — condições de elegibilidade',
  },
  {
    id: 'senador-x-deputado',
    kicker: 'QUEM REPRESENTA QUEM?',
    title: 'Qual a diferença entre Senador e Deputado Federal?',
    lead: 'Os dois legislam e fiscalizam no plano federal, mas são eleitos por sistemas diferentes e possuem papéis institucionais distintos.',
    paragraphs: [
      'Deputados federais representam o povo e são escolhidos pelo sistema proporcional. O número de deputados varia entre as unidades da Federação, e o mandato dura quatro anos.',
      'Senadores representam os estados e o Distrito Federal em condição de igualdade: cada unidade possui três cadeiras. São eleitos pelo sistema majoritário, para mandatos de oito anos.',
      'Além da atuação legislativa conjunta com a Câmara, o Senado possui competências privativas previstas na Constituição, como analisar determinadas autoridades indicadas pelo Poder Executivo e exercer atribuições específicas em matéria fiscal e institucional.',
    ],
    facts: ['Deputado: representação proporcional da população', 'Senador: representação igual dos estados e do DF', 'Deputado: 4 anos · Senador: 8 anos'],
    sources: [
      [OFFICIAL_SOURCES.federalSeats, 'Câmara — representação por UF'],
      [OFFICIAL_SOURCES.senate2026, 'Senado — composição e renovação'],
    ],
  },
];

function EditorialCard({ editorial }) {
  const sourceLinks = editorial.sources || [[editorial.source, editorial.sourceLabel]];
  return (
    <article className="civic-editorial" id={editorial.id}>
      <div className="civic-editorial-copy">
        <span className="civic-kicker">{editorial.kicker}</span>
        <h2>{editorial.title}</h2>
        <p className="civic-lead">{editorial.lead}</p>
        {editorial.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <div className="civic-source-links">
          {sourceLinks.map(([href, label]) => <a key={href} href={href} target="_blank" rel="noreferrer">{label} ↗</a>)}
        </div>
      </div>
      <aside className="civic-factbox" aria-label="Em resumo">
        <strong>Em resumo</strong>
        <ul>{editorial.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
      </aside>
    </article>
  );
}

export default function CivicEducationPage() {
  useEffect(() => {
    document.title = 'Entenda as Eleições | Eleições 2026';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = 'Guia apartidário sobre regras eleitorais, quociente eleitoral, votos brancos e nulos, Congresso, elegibilidade e eleitorado das Eleições 2026.';
  }, []);

  return (
    <div className="civic-page">
      <PlatformHeader current="entenda" />
      <main className="civic-main">
        <header className="civic-hero">
          <span className="civic-kicker">EDUCAÇÃO ELEITORAL</span>
          <h1>Entenda antes de votar</h1>
          <p>Regras eleitorais explicadas em linguagem direta, com fonte identificada e sem recomendação de candidatura, partido ou posição política.</p>
          <nav className="civic-index" aria-label="Nesta página">
            {EDITORIALS.map((item) => <a key={item.id} href={`#${item.id}`}>{item.title.replace('Você sabe ', '').replace('Você sabe', '').replace('Qual a ', '').replace('Quantos são e ', '')}</a>)}
            <a href="#eleitorado">Eleitorado por UF</a>
          </nav>
        </header>

        <section className="civic-editorials" aria-label="Editoriais explicativos">
          {EDITORIALS.map((editorial) => <EditorialCard key={editorial.id} editorial={editorial} />)}
        </section>

        <section className="civic-electorate" id="eleitorado">
          <div className="civic-section-heading">
            <div>
              <span className="civic-kicker">ELEITORADO 2026</span>
              <h2>Quantas pessoas estão aptas a votar?</h2>
            </div>
            <a href={OFFICIAL_SOURCES.electorateOpenData} target="_blank" rel="noreferrer">Dados abertos do TSE ↗</a>
          </div>

          <div className="civic-national-stats">
            <div><strong>{formatInteger(ELECTION_2026.electorateTotal)}</strong><span>eleitores aptos no total</span></div>
            <div><strong>{formatInteger(ELECTION_2026.electorateInStates)}</strong><span>nas 27 unidades da Federação</span></div>
            <div><strong>{formatInteger(ELECTION_2026.electorateAbroad)}</strong><span>no exterior</span></div>
            <div><strong>{ELECTION_2026.electorateReferenceDate}</strong><span>referência da base consolidada</span></div>
          </div>

          <p className="civic-data-note">O total nacional inclui o eleitorado no exterior. Brasileiros cadastrados no exterior votam apenas para presidente e vice-presidente da República. A tabela relaciona eleitorado e vagas federais para facilitar a leitura do peso de cada circunscrição.</p>

          <div className="civic-table-wrap" tabIndex="0" aria-label="Tabela de eleitorado e vagas por unidade da Federação">
            <table className="civic-table">
              <thead><tr><th>UF</th><th>Unidade da Federação</th><th>Eleitores aptos</th><th>Deputados federais</th><th>Senadores eleitos em 2026</th></tr></thead>
              <tbody>
                {ELECTORATE_BY_UF.map((item) => (
                  <tr key={item.uf}>
                    <td><strong>{item.uf}</strong></td>
                    <td>{item.name}</td>
                    <td>{formatInteger(item.electorate)}</td>
                    <td>{formatInteger(item.federalSeats)}</td>
                    <td>2</td>
                  </tr>
                ))}
                <tr className="civic-table-exterior"><td><strong>ZZ</strong></td><td>Exterior</td><td>{formatInteger(ELECTION_2026.electorateAbroad)}</td><td>—</td><td>—</td></tr>
              </tbody>
              <tfoot><tr><th colSpan="2">Total do eleitorado</th><th>{formatInteger(ELECTION_2026.electorateTotal)}</th><th>{formatInteger(ELECTION_2026.federalDeputySeats)}</th><th>{formatInteger(ELECTION_2026.senateSeatsContested2026)}</th></tr></tfoot>
            </table>
          </div>
          <p className="civic-data-note">Fontes: Tribunal Superior Eleitoral, Câmara dos Deputados e Senado Federal. O eleitorado é o recorte consolidado das Eleições 2026; candidaturas podem sofrer alterações até a eleição.</p>
        </section>

        <aside className="civic-method-note">
          <strong>Critério editorial</strong>
          <p>Este conteúdo explica regras e números públicos. Não atribui nota, ranking, recomendação de voto nem interpretação político-partidária. Quando houver atualização oficial que altere um dado, a referência deve ser versionada na documentação do projeto.</p>
          <p><a href="/metodologia">Metodologia</a> · <a href="/fontes">Fontes</a> · <a href="/?cargo=deputado-federal">Consultar candidaturas</a></p>
        </aside>
      </main>
    </div>
  );
}
