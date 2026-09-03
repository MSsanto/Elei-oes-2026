# O que ele fez?

Esta camada amplia o projeto Eleições 2026 para reunir, em um perfil factual e auditável, informações de candidatura e de exercício parlamentar.

## Objetivo

Responder, com dados públicos oficiais e sem juízo político, perguntas como:

- esta pessoa já exerceu mandato na Câmara dos Deputados?
- em quais legislaturas e partidos esteve registrada?
- quais despesas de exercício parlamentar foram publicadas pela Câmara?
- quais proposições constam com sua autoria?
- quais votos nominais foram registrados?
- quais emendas parlamentares aparecem associadas ao parlamentar?
- nas transferências especiais, qual ente recebeu o recurso, em qual UF/município, qual objeto foi declarado e quais informações de execução foram publicadas?

## Regra de neutralidade

O sistema não atribui nota, ranking, selo, índice de qualidade ou recomendação a candidato ou parlamentar. Também não produz comparação política entre pessoas. Os mesmos campos e critérios de exibição devem ser aplicados a todos os perfis.

## Fontes oficiais

### Tribunal Superior Eleitoral

Uso:

- candidatura;
- partido e número eleitoral;
- situação da candidatura;
- bens declarados;
- redes sociais;
- receitas e despesas eleitorais;
- fornecedores e doadores quando publicados nas bases oficiais.

Identificador principal no domínio eleitoral: `SQ_CANDIDATO`.

### Câmara dos Deputados — Dados Abertos

Uso:

- cadastro do deputado;
- histórico de exercício parlamentar;
- despesas do exercício parlamentar;
- proposições e autoria;
- tramitação;
- votações;
- voto nominal de cada parlamentar.

Identificador principal no domínio da Câmara: `idDeputado`.

Arquivos anuais de votações devem ser tratados como snapshots oficiais. O conjunto `votacoesVotos` registra, quando disponível, o voto/posicionamento individual do parlamentar e o horário do registro.

### Transferegov.br

Uso:

- transferências especiais, popularmente chamadas de “emendas Pix”;
- autor da emenda;
- beneficiário;
- UF e município beneficiário;
- valor indicado, empenhado/liberado/pago quando publicado;
- plano de ação/plano de trabalho;
- objeto de execução;
- situação do plano;
- relatório de gestão;
- documentos e informações de execução disponibilizados pelo ente beneficiário.

O sistema deve usar a denominação oficial **Transferência Especial** e pode exibir “emenda Pix” apenas como termo de busca/explicação ao público.

## Destinação da verba

O site não deve inferir um “destino final” sem documentação oficial suficiente.

Cada transferência terá uma trilha de rastreabilidade com estados explícitos:

1. **Indicada** — emenda identificada e beneficiário publicado.
2. **Transferida** — pagamento/liberação registrado na fonte oficial.
3. **Objeto declarado** — plano de trabalho ou objeto de execução publicado.
4. **Execução informada** — relatório de gestão ou informação equivalente publicada.
5. **Documentos de execução publicados** — contratos, notas, ordens bancárias, recibos ou outros comprovantes disponíveis na fonte oficial.

A interface deve distinguir sempre:

- `destinacao_declarada`: finalidade/objeto informado pelo ente;
- `execucao_publicada`: descrição do que o ente declarou executar;
- `documentos_publicados`: referências aos comprovantes existentes;
- `rastreabilidade`: estágio máximo que pode ser comprovado pelos dados disponíveis.

Ausência de dado não significa irregularidade; deve ser apresentada apenas como “não localizado/publicado na fonte consultada”.

## Identidade entre bases

TSE e Câmara usam identificadores diferentes. Nunca relacionar registros apenas pelo nome de urna.

Tabela de identidade proposta:

```text
politico_id interno
├── tse_sq_candidato[]
├── camara_id_deputado[]
├── nome_civil
├── data_nascimento
├── uf
├── correspondencia_status
└── evidencias_correspondencia[]
```

Estados de correspondência:

- `confirmada` — combinação de campos oficiais suficiente para uma associação inequívoca;
- `revisao_manual` — existem múltiplos registros possíveis ou conflito de campos;
- `nao_encontrada` — sem vínculo seguro com a outra base.

## Modelo da página individual

### 1. Eleições 2026

Foto, nome de urna, número, partido, UF, situação, patrimônio declarado e prestação de contas.

### 2. Histórico de mandato

Períodos de exercício, legislatura, partido registrado na época e situação do mandato conforme a Câmara.

### 3. Despesas do mandato

Tabela auditável por ano/mês, tipo de despesa, fornecedor/documento e valor, conforme Dados Abertos da Câmara.

### 4. Atividade legislativa

Proposições com autoria publicada, tramitação e demais metadados oficiais.

### 5. Votações

Votos nominais registrados, com data, votação, proposição relacionada quando identificável e valor oficial do voto (`Sim`, `Não`, `Abstenção`, `Obstrução` etc.).

É necessário preservar o aviso metodológico da Câmara de que nem toda votação possui associação perfeita com uma proposição e de que votos individuais são válidos principalmente em votações nominais.

### 6. Emendas e transferências

Lista das emendas atribuídas ao parlamentar e, para transferências especiais:

- ano;
- número da emenda;
- beneficiário;
- CNPJ do ente quando publicado;
- UF;
- município e código IBGE quando publicados;
- valor;
- situação;
- objeto/plano de trabalho;
- execução informada;
- documentos do relatório de gestão;
- link direto para a fonte oficial.

## Estrutura de dados proposta

```text
data/processed/
├── politicos/
│   └── {politico_id}.json
├── camara/
│   ├── deputados.json
│   ├── historico/
│   ├── despesas/
│   ├── proposicoes/
│   └── votacoes/
├── transferencias_especiais/
│   ├── emendas.json
│   ├── por_parlamentar/
│   ├── por_municipio/
│   └── planos/
└── mappings/
    └── identidades.json
```

## Fases de implementação

### Fase A — identidade

Criar o catálogo interno de políticos e o vínculo auditável TSE ↔ Câmara.

### Fase B — Câmara

Importar cadastro, histórico, despesas e votos nominais.

### Fase C — Transferegov

Importar transferências especiais e organizar por parlamentar, beneficiário e município.

### Fase D — rastreabilidade

Enriquecer planos de trabalho, relatórios de gestão e documentos públicos de execução.

### Fase E — interface

Adicionar as seções “Histórico de mandato”, “Despesas”, “Votações” e “Emendas e transferências” na página individual.

## Auditoria

Todo registro derivado deve armazenar:

- fonte;
- URL ou endpoint de origem;
- identificador oficial;
- data/hora da coleta;
- transformação aplicada;
- versão do pipeline.

Dados oficiais devem permanecer distinguíveis de campos calculados ou normalizados pelo projeto.
