# Eleições 2026 — Transparência de Campanhas

Projeto open source para organizar e tornar mais acessíveis os dados públicos das Eleições 2026, com foco inicial nas candidaturas a **Deputado Federal**.

## Objetivo

Coletar dados oficiais do Tribunal Superior Eleitoral (TSE), normalizar e catalogar receitas e despesas de campanha, publicar dados processados auditáveis e oferecer uma interface com busca, fotos oficiais, categorias e gráficos.

## Princípios

- Fonte primária: dados oficiais do TSE.
- Neutralidade: o sistema apresenta dados e métricas, sem atribuir juízo político aos candidatos.
- Auditabilidade: origem, data de coleta e regras de transformação devem ser públicas.
- Reprodutibilidade: o pipeline deverá poder ser executado localmente e pelo GitHub Actions.
- Dados derivados nunca substituem os campos originais do TSE.

## Fontes oficiais iniciais

- Candidaturas 2026: `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip`
- Prestação de contas de candidatos 2026: `https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2026.zip`

## Escopo do MVP

1. Baixar os arquivos oficiais.
2. Filtrar candidaturas a Deputado Federal.
3. Normalizar identificadores e campos essenciais.
4. Associar candidatos às respectivas receitas/despesas.
5. Gerar arquivos processados para consumo pelo frontend/API.
6. Automatizar atualizações com GitHub Actions.
7. Construir a interface pública de consulta.

> Projeto independente, sem vínculo com o Tribunal Superior Eleitoral, partidos ou candidatos.
