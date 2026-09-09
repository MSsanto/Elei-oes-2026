# Contexto eleitoral — candidaturas, vagas e eleitorado

## Objetivo

Adicionar às consultas das Eleições 2026 um bloco factual de contexto para ajudar a dimensionar cada disputa sem criar ranking, recomendação ou interpretação sobre candidaturas.

O bloco exibe, conforme o cargo e a circunscrição selecionada:

- número de candidaturas presentes na carga do projeto;
- número de vagas em disputa;
- relação aritmética `candidaturas / vagas`;
- número de eleitoras e eleitores aptos a votar no Brasil ou na UF selecionada.

## Fontes oficiais

### Candidaturas e vagas

Tribunal Superior Eleitoral — Portal de Dados Abertos — **Candidatos 2026**:

- conjunto: `https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026`
- candidaturas: base `consulta_cand_2026` já processada pelo projeto;
- vagas: recurso **Vagas**, arquivo `consulta_vagas_2026.zip`.

O TSE publica o número de vagas por cargo e circunscrição. O pipeline valida totais estruturais conhecidos para evitar publicação silenciosa de uma carga incompleta ou interpretada incorretamente.

### Eleitorado

Tribunal Superior Eleitoral — Portal de Dados Abertos — **Eleitorado 2026**:

- conjunto: `https://dadosabertos.tse.jus.br/pt_BR/dataset/eleitorado-2026`
- recurso nacional: `perfil_eleitorado_2026.zip`.

O arquivo é agregado por `SG_UF` usando `QT_ELEITORES_PERFIL`. O valor nacional inclui o eleitorado no exterior quando a fonte o identifica como `ZZ`.

O total publicado pelo TSE pode receber correções/atualizações da base oficial. A plataforma deve sempre preferir o valor derivado da carga versionada mais recente, mantendo a data de geração.

## Cálculo

Para cada cargo/circunscrição:

```text
candidaturas_por_vaga = candidaturas / vagas
```

Exemplo puramente matemático: 120 candidaturas para 10 vagas = 12 candidaturas por vaga.

### O que a razão NÃO significa

A relação **não** representa:

- probabilidade de eleição;
- competitividade individual;
- força partidária;
- chance estatística de cada candidatura;
- qualidade ou viabilidade de candidatura;
- recomendação de voto.

Ela é somente uma medida descritiva do volume de registros em relação ao número de cadeiras disponíveis.

## Situação das candidaturas

A contagem usa os registros presentes na carga do projeto, independentemente da situação judicial/administrativa do pedido de registro.

Isso é intencional. A situação oficial continua sendo exibida separadamente e não deve ser inferida a partir da presença ou ausência na contagem agregada.

## Escopo por cargo

- **Presidente:** Brasil; 1 vaga.
- **Governador:** UF selecionada; 1 vaga por UF/DF.
- **Senador:** UF selecionada; em 2026 são disputadas duas vagas por UF/DF, totalizando 54 no país.
- **Deputado Federal:** Brasil ou UF selecionada; vagas conforme distribuição oficial.
- **Deputado Estadual/Distrital:** UF selecionada; vagas conforme assembleia estadual ou Câmara Legislativa do DF.

## Arquitetura

Arquivo gerador:

- `scripts/build_election_context_2026.py`

Saída versionada:

- `data/processed/election-context.json`

Interface:

- `src/electionContext.jsx`
- `src/electionContext.css`

A interface carrega um único JSON agregado pequeno. Ela não percorre os arquivos completos de candidaturas para recalcular as estatísticas no navegador.

### Deputado Estadual/Distrital

A arquitetura de alta volumetria permanece inalterada:

- uma UF por vez;
- cartões em lotes de 60;
- índice de busca sob demanda;
- perfis em chunks;
- `AbortController`;
- `IntersectionObserver`;
- cache de perfis.

O novo contexto é carregado separadamente e não amplia a base estadual aberta no navegador.

## Validações mínimas do pipeline

A geração deve falhar antes de substituir a saída se:

- faltar uma das 27 UFs no eleitorado;
- o total nacional do eleitorado estiver fora de uma faixa estrutural plausível;
- o total de vagas de Presidente não for 1;
- o total nacional de Governador não for 27;
- o total nacional de Senador não for 54;
- o total de Deputado Federal não for 513;
- o total de Deputado Estadual/Distrital não for 1.059;
- o Distrito Federal não tiver 24 vagas de Deputado Distrital.

A gravação é atômica: uma carga inválida não deve substituir silenciosamente a última saída válida.

---

# Pauta editorial educativa

A camada de contexto abre uma trilha editorial de alfabetização eleitoral. Os conteúdos devem responder dúvidas objetivas usando TSE, Constituição, Câmara e Senado como fontes primárias.

## 1. “Você sabe o que é quociente eleitoral?”

### Gancho

**Você escolhe um deputado. Mas sabe por que nem sempre os mais votados ocupam todas as vagas?**

### Pontos obrigatórios

- deputado federal, estadual/distrital e vereador são escolhidos pelo sistema proporcional;
- o quociente eleitoral é obtido a partir dos votos válidos e do número de vagas da circunscrição;
- a distribuição também envolve quociente partidário, votação nominal mínima e regras de sobras;
- voto nominal e voto de legenda entram no sistema proporcional conforme as regras vigentes;
- não resumir o sistema como “o voto de um candidato simplesmente elege outro” sem explicar partido/federação e distribuição das cadeiras.

Fonte principal: TSE — materiais sobre quociente eleitoral, partidário e distribuição de sobras.

## 2. “Você sabe a diferença entre votos brancos e votos nulos?”

### Gancho

**Branco e nulo são registrados de maneiras diferentes. Mas eles mudam o resultado de formas diferentes?**

### Pontos obrigatórios

- branco: uso da tecla `BRANCO` e confirmação;
- nulo: digitação de número inexistente e confirmação;
- ambos são excluídos dos votos válidos;
- não são transferidos para candidato, partido ou federação;
- maioria de votos brancos/nulos não anula automaticamente uma eleição;
- evitar reproduzir o mito histórico de que voto branco “vai para quem está ganhando”.

Fonte principal: TSE — Glossário Eleitoral e explicadores sobre votos válidos.

## 3. “Quantos deputados federais e senadores existem — e como essas vagas são divididas?”

### Gancho

**São Paulo e Acre elegem o mesmo número de senadores. Mas não elegem o mesmo número de deputados federais. Por quê?**

### Pontos obrigatórios

- Câmara dos Deputados: 513 cadeiras, distribuídas entre estados e DF segundo as regras constitucionais/legais de representação populacional;
- Senado: 81 cadeiras, exatamente três por estado e três para o DF;
- mandato de deputado federal: quatro anos;
- mandato de senador: oito anos;
- o Senado é renovado alternadamente por 1/3 e 2/3;
- nas Eleições 2026 a renovação é de 2/3, portanto 54 vagas: duas em cada UF/DF;
- deixar visualmente clara a diferença entre representação populacional da Câmara e representação igualitária das unidades federativas no Senado.

Fontes principais: Câmara dos Deputados, Senado Federal, Constituição Federal e TSE.

## Diretriz editorial

Os posts devem informar **como o sistema funciona**, sem transformar regras eleitorais em argumento a favor ou contra partidos, candidaturas ou modelos políticos. Fórmulas e exemplos devem usar números hipotéticos ou agregados oficiais, nunca casos escolhidos para induzir julgamento sobre uma candidatura específica.
