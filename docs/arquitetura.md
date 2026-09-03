# Arquitetura

## Visão geral

O projeto continua priorizando pré-processamento e arquivos estáticos para manter custo baixo, mas agora passa a integrar três domínios oficiais distintos:

```text
TSE
│ candidaturas / contas / bens
│
├───────────────┐
│               ▼
│        identidade politica
│               ▲
│               │
│       Câmara dos Deputados
│       mandato / despesas
│       proposições / votações
│               │
│               ▼
│      perfil factual unificado
│               ▲
│               │
└────── Transferegov.br
        emendas / transferências especiais
        beneficiário / município / execução publicada
                │
                ▼
       data/processed/*.json
                │
                ▼
             GitHub
                │
                ▼
        Cloudflare Pages
```

## Estratégia de processamento

O pipeline faz o trabalho pesado antes da visita do usuário:

1. coleta dados oficiais;
2. preserva identificadores de origem;
3. normaliza campos sem apagar os valores originais relevantes;
4. resolve identidades entre bases com evidências auditáveis;
5. calcula somente agregações objetivas;
6. gera JSONs particionados;
7. publica apenas uma carga validada.

O site lê os resultados processados e sempre informa a fonte e a data de atualização.

## Domínios

### Eleitoral — TSE

Chave primária: `SQ_CANDIDATO` quando disponível.

Dados:

- candidatura;
- partido/número;
- bens;
- redes sociais;
- receitas/despesas eleitorais;
- fornecedores/doadores.

### Parlamentar — Câmara dos Deputados

Chave de origem: `idDeputado`.

Dados:

- cadastro;
- histórico de exercício;
- despesas parlamentares;
- proposições e autoria;
- tramitações;
- votações;
- votos nominais.

Para votos individuais, os arquivos anuais `votacoesVotos` são apropriados para processamento em lote. A ligação votação ↔ proposição deve preservar as limitações metodológicas documentadas pela própria Câmara.

### Transferências — Transferegov.br

Dados:

- emenda;
- parlamentar autor;
- beneficiário;
- UF/município;
- valores e situação;
- planos de ação/trabalho;
- objeto declarado;
- relatório de gestão;
- documentos e informações de execução publicados.

A aplicação deve usar o termo oficial `Transferência Especial`; “emenda Pix” pode aparecer somente como explicação/termo de busca.

## Camada de identidade

Bases diferentes não compartilham necessariamente o mesmo identificador.

```text
politico_id
├── tse_sq_candidato[]
├── camara_id_deputado[]
├── nome_civil
├── data_nascimento
├── uf
├── correspondencia_status
└── evidencias_correspondencia[]
```

Nunca promover uma correspondência apenas por semelhança de nome.

Estados:

- `confirmada`;
- `revisao_manual`;
- `nao_encontrada`.

## Estrutura de armazenamento

```text
data/processed/
├── deputados_federais.json
├── ufs/
├── politicos/
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

Arquivos brutos grandes devem permanecer temporários durante o ETL; o Git recebe apenas derivados necessários à aplicação e auditoria.

## Rastreabilidade de transferências especiais

A aplicação não deve deduzir destino final de recursos.

Estados objetivos:

```text
indicada
  ↓
transferida
  ↓
objeto_declarado
  ↓
execucao_informada
  ↓
documentos_execucao_publicados
```

Campos distintos:

- `destinacao_declarada`;
- `execucao_publicada`;
- `documentos_publicados`;
- `rastreabilidade`.

Se uma informação não estiver disponível na fonte consultada, exibir `não localizado/publicado na fonte consultada`, sem inferência adicional.

## Neutralidade

O produto não terá ranking, score, nota, selo ou recomendação política. Também não implementará comparação avaliativa entre políticos.

Os perfis usarão o mesmo conjunto de campos e as mesmas regras de transformação. Valores agregados devem ser puramente descritivos e manter ligação com os registros que os originaram.

## Fases

### Fase 1 — eleitoral

- candidaturas;
- contas eleitorais;
- fornecedores;
- gráficos descritivos.

### Fase 2 — identidade e Câmara

- catálogo de políticos;
- vínculo TSE ↔ Câmara;
- histórico de mandato;
- despesas;
- proposições;
- votos nominais.

### Fase 3 — Transferegov

- emendas;
- transferências especiais;
- beneficiário e município;
- planos de trabalho;
- relatório de gestão e documentos publicados.

### Fase 4 — índice/API

Cloudflare Worker + D1 para pesquisa, filtros combinados, indexação de municípios/beneficiários e endpoints públicos versionados.

## Auditoria por registro

Sempre que aplicável, armazenar:

- autoridade/fonte;
- URL/endpoint;
- identificador oficial;
- data da coleta;
- versão do pipeline;
- transformação aplicada.
