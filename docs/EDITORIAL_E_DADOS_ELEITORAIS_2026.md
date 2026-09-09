# Editorial e dados eleitorais — Eleições 2026

## Objetivo

Esta entrega amplia a plataforma **Eleições 2026 — Transparência Eleitoral** com duas camadas de contexto público:

1. indicadores objetivos de **candidaturas, vagas, concorrência e eleitorado** na consulta de Deputado Federal;
2. uma área de **educação eleitoral apartidária**, chamada `Entenda`, com explicações de regras que afetam a leitura dos dados e do resultado das urnas.

A proposta não é recomendar candidaturas nem transformar indicadores descritivos em ranking. Os textos devem explicar **como o sistema funciona**, indicar a fonte e separar fatos normativos de análise política.

---

## 1. Indicadores da aba Deputado Federal

O bloco `Panorama da disputa` apresenta, para Brasil ou UF selecionada:

| Indicador | Regra |
|---|---|
| Candidaturas | Contagem da carga atual de `/data/deputados_federais.json` |
| Vagas | 513 no Brasil; por UF conforme distribuição oficial da Câmara |
| Candidatos por vaga | `candidaturas do recorte / vagas do recorte` |
| Eleitores aptos | Cadastro eleitoral consolidado para as Eleições 2026 |

### Por que a quantidade de candidaturas é dinâmica?

Pedidos de registro podem mudar durante a campanha por julgamento, indeferimento, renúncia, falecimento ou substituição. Por isso, o código não grava um número nacional fixo de candidaturas: a métrica usa a própria carga publicada no projeto.

As **vagas**, por outro lado, são tratadas como dado normativo da eleição. Em 2026 permanecem **513 vagas de deputado federal**. A Câmara dos Deputados publicou checagem específica em 4 de setembro de 2026 esclarecendo que a próxima legislatura continua com 513, e não 531 cadeiras.

Fonte: https://www.camara.leg.br/comprove/1302885-e-falso-que-sao-531-vagas-de-deputados-federais-para-a-proxima-legislatura

Distribuição por UF: https://www2.camara.leg.br/a-camara/conheca/numero-de-deputados-por-estado

Candidaturas: https://dadosabertos.tse.jus.br/dataset/candidatos-2026

---

## 2. Eleitorado apto em 2026

**Referência do recorte consolidado:** 20/07/2026.

- Total: **158.745.463** eleitoras e eleitores aptos.
- Nas 27 unidades da Federação: **157.826.587**.
- Exterior: **918.876**.
- O eleitorado no exterior participa apenas da eleição para presidente e vice-presidente da República.

Fonte TSE: https://www.tse.jus.br/comunicacao/noticias/2026/Julho/mais-de-158-milhoes-de-eleitores-estao-aptos-votar-nas-eleicoes-2026

Dados abertos: https://dadosabertos.tse.jus.br/dataset/eleitorado-2026

### Eleitorado e representação federal por UF

| UF | Eleitores aptos | Deputados federais | Senadores eleitos em 2026 |
|---|---:|---:|---:|
| AC | 614.375 | 8 | 2 |
| AL | 2.441.794 | 9 | 2 |
| AP | 577.534 | 8 | 2 |
| AM | 2.801.182 | 8 | 2 |
| BA | 11.321.005 | 39 | 2 |
| CE | 6.998.494 | 22 | 2 |
| DF | 2.253.132 | 8 | 2 |
| ES | 2.990.490 | 10 | 2 |
| GO | 5.080.755 | 17 | 2 |
| MA | 5.186.562 | 18 | 2 |
| MT | 2.638.230 | 8 | 2 |
| MS | 2.024.884 | 8 | 2 |
| MG | 16.377.659 | 53 | 2 |
| PA | 6.265.355 | 17 | 2 |
| PB | 3.247.397 | 12 | 2 |
| PR | 8.609.026 | 30 | 2 |
| PE | 7.225.744 | 25 | 2 |
| PI | 2.708.160 | 10 | 2 |
| RJ | 12.857.000 | 46 | 2 |
| RN | 2.660.565 | 8 | 2 |
| RS | 8.526.233 | 31 | 2 |
| RO | 1.267.105 | 8 | 2 |
| RR | 401.496 | 8 | 2 |
| SC | 5.725.753 | 16 | 2 |
| SP | 34.104.226 | 70 | 2 |
| SE | 1.740.124 | 8 | 2 |
| TO | 1.182.307 | 8 | 2 |
| Exterior | 918.876 | — | — |
| **Total** | **158.745.463** | **513** | **54** |

### Nota sobre totais divergentes em páginas do TSE

Para evitar mistura de snapshots administrativos, a plataforma adota neste módulo o **recorte consolidado divulgado pelo TSE em 20/07/2026 e o conjunto de Dados Abertos Eleitorado — 2026**. Se o TSE publicar retificação formal ou nova base consolidada para o pleito, o arquivo `src/election2026Facts.js` deve ser versionado com a nova data de referência.

---

## 3. Editorial “Você sabe o que é quociente eleitoral?”

### Regra central

O **quociente eleitoral (QE)** é calculado assim:

`QE = votos válidos / número de vagas`

Ele é usado nas eleições proporcionais: deputado federal, deputado estadual, deputado distrital e vereador.

O QE não significa que “quem atingir esse número está automaticamente eleito”. A distribuição passa pelo desempenho de partidos e federações, pelo quociente partidário e pelas regras de distribuição das vagas e sobras, além dos requisitos de votação nominal aplicáveis.

Votos brancos e nulos não são votos válidos e não entram no QE.

Fonte: https://www.tse.jus.br/comunicacao/noticias/2026/Abril/por-dentro-das-eleicoes-brasil-utiliza-sistemas-eleitorais-majoritario-e-proporcional

Glossário TSE: https://www.tse.jus.br/servicos-eleitorais/glossario/termos/quociente-eleitoral

---

## 4. Editorial “Você sabe a diferença entre votos brancos e votos nulos?”

- **Branco:** eleitor pressiona a tecla `Branco` e confirma.
- **Nulo:** eleitor digita e confirma um número que não corresponde a candidatura válida para o cargo.
- Os dois ficam fora da contagem de **votos válidos**.
- Não são transferidos para a candidatura mais votada.
- Não entram no cálculo do quociente eleitoral.
- Mesmo em grande quantidade, não “anulam a eleição”.

Fonte: https://www.tse.jus.br/comunicacao/noticias/2026/Julho/voto-branco-x-voto-nulo-saiba-a-diferenca-de-acordo-com-o-glossario-eleitoral

---

## 5. Editorial “Quantos são e como são divididos os deputados federais e senadores?”

### Câmara dos Deputados

- **513 cadeiras**.
- Todas são renovadas em 2026.
- Mandato de **4 anos**.
- Cada UF possui entre **8 e 70 deputados**, conforme a distribuição vigente.
- Eleição pelo sistema **proporcional**.

Fonte: https://www.camara.leg.br/noticias/1298957-eleicoes-deste-ano-vao-definir-54-vagas-no-senado-e-todas-as-513-vagas-da-camara

### Senado Federal

- **81 cadeiras** no total.
- **3 senadores por estado e pelo Distrito Federal**.
- Mandato de **8 anos**.
- Renovação alternada de **1/3 e 2/3**.
- Em 2026, são disputadas **54 vagas**: dois senadores por UF.
- Eleição pelo sistema **majoritário**.

Fonte: https://www12.senado.leg.br/noticias/materias/2026/07/14/eleitor-escolhera-dois-senadores-neste-ano-veja-como-votar

---

## 6. Editorial “Você sabe o que é preciso para ser governador?”

Condições gerais de elegibilidade:

- nacionalidade brasileira;
- pleno exercício dos direitos políticos;
- alistamento eleitoral;
- domicílio eleitoral na circunscrição;
- filiação partidária;
- ausência de causa de inelegibilidade;
- idade mínima de **30 anos**, aferida na data da posse para cargos do Poder Executivo.

A eleição para governador é majoritária. A vitória em primeiro turno exige maioria absoluta dos votos válidos; não havendo, ocorre segundo turno entre os dois mais votados.

Fonte: https://www.tse.jus.br/servicos-eleitorais/glossario/termos/elegibilidade

Base constitucional: art. 14 da Constituição Federal.

---

## 7. Editorial “Qual a diferença entre Senador e Deputado Federal?”

| Deputado Federal | Senador |
|---|---|
| Representa o povo | Representa o estado ou o Distrito Federal |
| Sistema proporcional | Sistema majoritário |
| 513 cadeiras | 81 cadeiras |
| Mandato de 4 anos | Mandato de 8 anos |
| Quantidade varia por UF | 3 por UF |
| Todas as vagas renovadas a cada eleição geral | Renovação alternada de 1/3 e 2/3 |

Os dois participam da elaboração das leis federais e da fiscalização do poder público, mas cada Casa possui competências constitucionais próprias.

---

## 8. Política editorial e de atualização

1. **Fonte primária primeiro:** TSE, Câmara dos Deputados, Senado Federal, Constituição e legislação eleitoral.
2. **Data de referência visível:** números sujeitos a atualização devem informar o snapshot utilizado.
3. **Candidaturas são mutáveis:** preferir contagem derivada da carga atual da plataforma.
4. **Vagas são dados normativos:** só alterar mediante fonte oficial aplicável ao pleito de 2026.
5. **Sem ranking político:** candidatos/vaga é indicador de concorrência matemática, não de qualidade, competitividade individual ou chance de vitória.
6. **Correções transparentes:** qualquer retificação relevante deve ser registrada no histórico do Git e, quando aplicável, na página de correções da plataforma.

## 9. Arquivos da implementação

- `src/election2026Facts.js` — eleitorado, vagas e fontes versionadas.
- `src/FederalElectionStats.jsx` — painel dinâmico da aba Deputado Federal.
- `src/federalElectionStats.css` — estilos do painel.
- `src/CivicEducationPage.jsx` — editoriais e tabela do eleitorado.
- `src/civicEducation.css` — estilos da página `Entenda`.
- `src/appEntry.jsx` — rota `/entenda` e integração do painel.
- `src/PlatformHeader.jsx` — item de menu `Entenda`.
