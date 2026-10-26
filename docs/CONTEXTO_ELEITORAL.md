# Contexto eleitoral — candidaturas, vagas e eleitorado

**Escopo:** Eleições Gerais de 2026  
**Estado:** snapshot histórico de encerramento  
**Interface:** abas de Presidente, Governador, Senador, Deputado Federal e Deputado Estadual/Distrital

## Objetivo

Acrescentar contexto quantitativo às consultas de candidaturas sem criar ranking, recomendação ou interpretação de competitividade.

O bloco **Contexto da eleição** apresenta, para o cargo e a circunscrição selecionados:

- número de candidaturas presentes na base arquivada do projeto;
- número de vagas em disputa;
- relação aritmética de candidaturas por vaga;
- número de eleitoras e eleitores aptos no país ou na UF selecionada.

A relação candidaturas/vaga é exclusivamente descritiva. Ela **não** representa chance de eleição, probabilidade, força eleitoral, avaliação de candidatura ou recomendação de voto.

## Fontes oficiais

### Candidaturas

Tribunal Superior Eleitoral — Dados Abertos — Candidatos 2026:

https://dadosabertos.tse.jus.br/dataset/candidatos-2026

A interface usa as bases já processadas e versionadas pelo projeto. Portanto, o numerador da relação candidaturas/vaga corresponde aos registros presentes no snapshot arquivado, sem excluir silenciosamente candidaturas por situação de julgamento.

### Vagas

Tribunal Superior Eleitoral — CDE 2026:

https://www.tse.jus.br/eleicoes/cde-2026

O TSE informa para 2026:

- Presidente: 1 vaga;
- Governadores: 27 vagas, uma por unidade da Federação;
- Senado: 54 vagas, duas por unidade da Federação;
- Câmara dos Deputados: 513 vagas;
- Assembleias Legislativas: 1.035 vagas;
- Câmara Legislativa do Distrito Federal: 24 vagas.

Para Deputado Federal, a distribuição por UF segue a representação oficial da Câmara. Para Deputado Estadual/Distrital, a quantidade por UF é derivada da regra constitucional reproduzida na Resolução TSE nº 23.748/2026: triplo da representação na Câmara até 36 cadeiras e, acima de 12 deputados federais, acréscimo correspondente.

Referência normativa:

https://www.tse.jus.br/legislacao/compilada/res/2026/resolucao-no-23-748-de-26-de-fevereiro-de-2026

### Eleitorado

Tribunal Superior Eleitoral — Eleições 2026 em números, referência consolidada publicada em 04/10/2026:

https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/eleicoes-2026-em-numeros-158-7-milhoes-de-eleitores-estao-aptos-a-votar

Dados abertos:

https://dadosabertos.tse.jus.br/dataset/eleitorado-2026

Total nacional: **158.745.463** pessoas aptas, incluindo **918.876** no exterior.

Para cargos estaduais e legislativos federais, o panorama nacional considera o eleitorado das 27 unidades da Federação. Para Presidente, o total inclui o eleitorado no exterior, que participa da eleição presidencial.

## Regras de cálculo

### Candidaturas por vaga

```text
candidaturas por vaga = candidaturas no snapshot / vagas oficiais
```

A apresentação usa uma casa decimal.

Exemplo meramente matemático: 319 candidaturas ao Senado ÷ 54 vagas = 5,9 candidaturas por vaga.

O indicador não considera:

- situação jurídica individual;
- distribuição partidária ou federativa;
- quociente eleitoral;
- intenção de voto;
- desempenho histórico;
- financiamento;
- coligações/federações como fator de competitividade;
- qualquer modelo probabilístico.

## Escopo por aba

### Presidente

- circunscrição: Brasil;
- vagas: 1;
- eleitorado: total nacional, incluindo exterior.

### Governador

- sem UF selecionada: panorama das 27 disputas;
- com UF selecionada: uma vaga e eleitorado da respectiva UF.

### Senador

- sem UF selecionada: 54 vagas nacionais;
- com UF selecionada: duas vagas e eleitorado da respectiva UF.

### Deputado Federal

- sem UF: 513 vagas e eleitorado das 27 UFs;
- com UF: representação federal oficial e eleitorado da UF.

### Deputado Estadual / Distrital

- sem UF: 1.059 vagas no conjunto das Assembleias Legislativas e da CLDF;
- com UF: vagas da respectiva casa legislativa e eleitorado da UF;
- Distrito Federal: 24 vagas de Deputado Distrital.

## Arquitetura

A feature não altera a arquitetura de alto volume de Deputado Estadual/Distrital.

Continuam preservados:

- seleção obrigatória de UF na consulta detalhada;
- lotes de 60 cartões;
- índice de busca carregado sob demanda;
- perfis em chunks;
- AbortController;
- IntersectionObserver;
- cache de perfis;
- somente uma base estadual carregada por vez.

O panorama lê apenas o manifest estadual para obter a contagem agregada. Não carrega o índice de busca nem todos os perfis para calcular o indicador.

## Educação eleitoral relacionada

A rota `/entenda` reúne os editoriais explicativos:

- **Você sabe o que é quociente eleitoral?**
- **Você sabe a diferença entre votos brancos e votos nulos?**
- **Quantos são e como são divididos os deputados federais e senadores?**

O conteúdo usa fontes oficiais e linguagem apartidária, sem aconselhamento de voto.

## Encerramento 2026

Esta implementação respeita o congelamento pós-eleição documentado em `ENCERRAMENTO_2026.md`.

Ela não reativa cron, watchdog ou coleta automática. Os números de candidaturas são lidos do snapshot versionado do próprio projeto; vagas e eleitorado correspondem às referências oficiais consolidadas de 2026.
