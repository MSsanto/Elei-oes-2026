# Arquitetura inicial

## Estratégia do MVP

O projeto será construído para funcionar sem servidor dedicado no início.

```text
TSE Dados Abertos
       |
       v
GitHub Actions (Python ETL)
       |
       +--> data/processed/*.json
       |
       v
Frontend estático (Cloudflare Pages)
       |
       +--> consulta arquivos processados
       |
       +--> futuramente: Cloudflare Worker + D1 para busca/indexação
```

## Por que começar estático

A maior parte das informações eleitorais muda apenas quando o TSE publica novas extrações. Não precisamos recalcular dados a cada visita do usuário.

O pipeline realiza o trabalho pesado previamente:

1. baixa os conjuntos oficiais;
2. filtra Deputado Federal;
3. normaliza os campos;
4. calcula agregações;
5. gera JSONs pequenos e particionados;
6. publica as alterações no repositório.

O site apenas lê esses resultados.

Isso reduz custo, complexidade e superfície de falha.

## Evolução prevista

### Fase 1 — arquivos estáticos

- candidatos por UF;
- resumo por candidato;
- categorias de despesas;
- maiores fornecedores;
- metadados de origem e atualização.

### Fase 2 — índice de pesquisa

Cloudflare Worker + D1 para:

- busca por candidato;
- busca por fornecedor;
- filtros combinados;
- comparação entre candidaturas.

### Fase 3 — API pública

Endpoints versionados para permitir que terceiros consumam os dados tratados pelo projeto.

## Regra de armazenamento

Os arquivos brutos do TSE não devem ser versionados no Git. Eles são baixados durante o ETL e descartados após o processamento. O repositório guarda apenas dados derivados necessários para auditoria e funcionamento do sistema.

## Identidade dos registros

Sempre que disponível, `SQ_CANDIDATO` será a chave principal para relacionar os conjuntos do TSE. Campos textuais como nome de urna não devem ser usados como identificadores.
