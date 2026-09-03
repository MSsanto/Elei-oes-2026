# Eleições 2026 — Transparência de Campanhas e Mandatos

Projeto open source para organizar e tornar mais acessíveis dados públicos eleitorais e parlamentares, com foco inicial nas candidaturas a **Deputado Federal**.

**Site:** https://eleicoes-2026-ebz.pages.dev

## Objetivo

Unificar dados oficiais do Tribunal Superior Eleitoral (TSE) com dados públicos de exercício parlamentar para oferecer perfis factuais e auditáveis.

O projeto passa a ter duas camadas principais:

1. **Eleições 2026** — candidatura, foto, partido, patrimônio declarado, receitas, despesas, fornecedores e demais dados eleitorais oficiais.
2. **O que ele fez?** — histórico de mandato, despesas parlamentares, proposições, votos nominais, emendas e transferências especiais, incluindo beneficiário, município, objeto declarado e informações de execução publicadas.

## Princípios

- Fontes oficiais como base dos fatos exibidos.
- Neutralidade: o sistema apresenta registros e métricas sem atribuir juízo político.
- Sem ranking, nota, selo ou recomendação sobre candidatos ou parlamentares.
- Mesmos campos e regras de exibição para todos os perfis.
- Auditabilidade: origem, data de coleta e regras de transformação devem ser públicas.
- Reprodutibilidade: o pipeline pode ser executado localmente e validado pelo GitHub Actions.
- Dados derivados nunca substituem os campos originais das fontes.
- Falha de coleta nunca deve sobrescrever a última base válida.
- Ausência de informação publicada não deve ser interpretada como irregularidade.

## Fontes oficiais

- TSE — Candidaturas 2026: `https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026`
- TSE — Prestação de Contas Eleitorais 2026: `https://dadosabertos.tse.jus.br/pt_BR/dataset/prestacao-de-contas-eleitorais-2026`
- Câmara dos Deputados — Dados Abertos: `https://dadosabertos.camara.leg.br/swagger/api.html`
- Transferegov.br — Dados Abertos: `https://api-publica.transferegov.gestao.gov.br/`
- Transferegov.br — Transferências Especiais: `https://docs.api.transferegov.gestao.gov.br/transferenciasespeciais/`

Catálogo legível por máquina: [`config/fontes_oficiais.json`](config/fontes_oficiais.json)

## Arquitetura resumida

```text
                 TSE
                  │
                  ├── candidaturas / contas
                  │
                  ▼
           identidade politica
                  ▲
                  │
      Câmara dos Deputados
      │ mandato / despesas
      │ proposições / votações
                  │
                  ▼
          perfil factual unificado
                  ▲
                  │
             Transferegov
      emendas / transferências especiais
      município / plano / execução publicada
                  │
                  ▼
                 GitHub
                  │
                  ▼
           Cloudflare Pages
```

TSE e Câmara possuem identificadores próprios. O projeto não deve associar pessoas somente pelo nome: o vínculo entre bases terá status de correspondência e evidências auditáveis.

## “O que ele fez?”

A especificação da nova camada está em [`docs/O_QUE_ELE_FEZ.md`](docs/O_QUE_ELE_FEZ.md).

O perfil individual deverá reunir, quando houver dados oficiais disponíveis:

- histórico de mandato;
- despesas do exercício parlamentar;
- proposições com autoria publicada;
- votos nominais registrados;
- emendas parlamentares;
- transferências especiais (“emendas Pix” como termo popular);
- ente beneficiário;
- UF e município;
- valores e situação;
- plano de trabalho/objeto declarado;
- relatório de gestão;
- documentos de execução publicados.

Para transferências especiais, o produto diferencia **destinação declarada** de **execução publicada**. O sistema não afirma destino final de uma verba quando os dados oficiais não permitem comprová-lo.

Schema inicial do perfil unificado: [`data/schema/politico.schema.json`](data/schema/politico.schema.json)

## Arquitetura atual de coleta

```text
TSE
 │
 │ coleta a partir de conexão brasileira
 ▼
Coletor local no Windows
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

Os primeiros testes receberam HTTP 403 do TSE em acessos automatizados. Por isso, o pipeline possui estratégias alternativas de coleta local, enquanto o GitHub Actions fica responsável pela validação do projeto.

## Coleta nacional no Windows

Depois de clonar o repositório, execute:

`COLETAR_E_PUBLICAR.bat`

Para instalar atualização automática 4 vezes ao dia:

`INSTALAR_ATUALIZACAO_AUTOMATICA.bat`

Documentação: [`docs/COLETA_WINDOWS.md`](docs/COLETA_WINDOWS.md)

## Roadmap

1. Carga nacional de candidaturas a Deputado Federal.
2. Busca com autocomplete por candidato, número e partido.
3. Foto e dados cadastrais oficiais.
4. Prestação de contas eleitoral, receitas, despesas e fornecedores.
5. Catálogo interno de identidade TSE ↔ Câmara.
6. Histórico de mandato e despesas parlamentares.
7. Proposições e votos nominais.
8. Emendas e transferências especiais por parlamentar, beneficiário e município.
9. Rastreabilidade de plano de trabalho, relatório de gestão e documentos publicados.
10. API pública versionada.

> Projeto independente, sem vínculo com TSE, Câmara dos Deputados, Transferegov.br, partidos ou candidatos.
