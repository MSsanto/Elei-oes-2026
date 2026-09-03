# Eleições 2026 — Transparência de Campanhas

Projeto open source para organizar e tornar mais acessíveis os dados públicos das Eleições 2026, com foco inicial nas candidaturas a **Deputado Federal**.

**Site:** https://eleicoes-2026-ebz.pages.dev

## Objetivo

Coletar dados oficiais do Tribunal Superior Eleitoral (TSE), normalizar e catalogar receitas e despesas de campanha, publicar dados processados auditáveis e oferecer uma interface com busca, fotos oficiais, categorias e gráficos.

## Princípios

- Fonte primária: dados oficiais do TSE.
- Neutralidade: o sistema apresenta dados e métricas, sem atribuir juízo político aos candidatos.
- Auditabilidade: origem, data de coleta e regras de transformação devem ser públicas.
- Reprodutibilidade: o pipeline pode ser executado localmente e validado pelo GitHub Actions.
- Dados derivados nunca substituem os campos originais do TSE.
- Falha de coleta nunca deve sobrescrever a última base válida.

## Fontes oficiais iniciais

- Candidaturas 2026: `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip`
- DivulgaCandContas: `https://divulgacandcontas.tse.jus.br/`
- Prestação de contas de candidatos 2026: `https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2026.zip`

## Arquitetura atual

```text
TSE
 │
 │ coleta a partir de conexão brasileira
 ▼
Coletor Python no Windows
 │
 ├── deputados_federais.json
 ├── metadata.json
 └── ufs/*.json
 │
 ▼
GitHub
 │
 ▼
Cloudflare Pages
 │
 ▼
Site público
```

Os runners públicos do GitHub usados nos primeiros testes receberam bloqueio HTTP 403 do TSE. Por isso, a coleta nacional foi preparada para executar em um computador no Brasil, enquanto o GitHub Actions fica responsável pela validação do projeto.

## Coleta nacional no Windows

Depois de clonar o repositório, execute:

`COLETAR_E_PUBLICAR.bat`

O arquivo baixa os dados oficiais, filtra Deputado Federal, gera a carga nacional, faz commit/push quando houver alteração e dispara indiretamente o novo deploy do Cloudflare.

Para instalar atualização automática 4 vezes ao dia:

`INSTALAR_ATUALIZACAO_AUTOMATICA.bat`

Documentação completa: [`docs/COLETA_WINDOWS.md`](docs/COLETA_WINDOWS.md)

## Escopo do MVP

1. Carga nacional de candidaturas a Deputado Federal.
2. Busca com autocomplete por candidato, número e partido.
3. Foto e dados cadastrais oficiais.
4. Prestação de contas, receitas e despesas.
5. Categorias de gastos e fornecedores.
6. Gráficos e páginas individuais.
7. Dados processados públicos e auditáveis no GitHub.

> Projeto independente, sem vínculo com o Tribunal Superior Eleitoral, partidos ou candidatos.
