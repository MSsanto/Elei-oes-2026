# Snapshot final — Eleições 2026 (26/10/2026)

**Situação dos dados:** coleta final concluída e validada.  
**Data da totalização arquivada:** 26/10/2026, 10h13 (Brasília; 13:13:20 UTC).  
**Commit dos dados:** `8098ac3f62c51f49358cf1fbbffc6a1685a9fb2e`.  
**Blob SHA do arquivo de resultados:** `7f4b62adab793bd89abbdc084c924a5b22d2c92a`.  
**Execução da coleta final:** https://github.com/MSsanto/Elei-oes-2026/actions/runs/40327982241

## 1. Confirmação do segundo turno em fontes oficiais

O segundo turno ocorreu em 25/10/2026. O TSE anunciou em 26/10, às 00h18, a reeleição de **Luiz Inácio Lula da Silva (PT)** com **64.256.232 votos (51,79% dos votos válidos)**; **Flávio Bolsonaro (PL)** recebeu **59.826.041 (48,21%)**.

Fonte oficial: https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/presidente-do-tse-anuncia-reeleicao-de-lula-e-faz-balanco-do-2o-turno-das-eleicoes-2026

O TSE também confirmou os seis governos estaduais/distrital decididos no segundo turno: **Mailza Assis (AC), Omar Aziz (AM), Celina Leão (DF), Lorenzo Pazolini (ES), Cadu de Lula (RN) e Vicentinho Júnior (TO)**. As notícias individuais constam no índice de 25/10/2026 do TSE: https://www.tse.jus.br/comunicacao/noticias/2026

Os arquivos de totalização de 2º turno confirmados no snapshot correspondem a `6258/BR` e `6260/{AC,AM,DF,ES,RN,TO}`. Os **21 HTTP 404** restantes são circunscrições sem segundo turno para governador; não foram interpretados como resultados pendentes ou candidaturas derrotadas.

## 2. Resultado oficial arquivado

O arquivo `data/processed/resultados-2026/status-por-candidato.json` contém **18.842 candidaturas com resultado conclusivo** em **116 arquivos oficiais validados**, com vínculo exclusivo por `SQ_CANDIDATO`.

| Cargo | Eleitas e eleitos |
|---|---:|
| Presidente | 1 |
| Governador | 27 |
| Senador | 54 |
| Deputado Federal | 513 |
| Deputado Estadual/Distrital | 1.059 |
| **Total** | **1.654** |

As **17.188** demais candidaturas classificadas no snapshot constam como `nao_eleito`. Ausências ou registros inconclusivos na base de resultados permanecem **Não confirmado** na interface, sem inferência de derrota. Este é um registro histórico da totalização publicada em 26/10, não um mecanismo de acompanhamento de decisões judiciais futuras.

## 3. Última atualização das demais bases

A execução única de 26/10 concluiu com sucesso a coleta de candidaturas, situação dos registros, finanças, patrimônio e resultados. As fontes foram preservadas no commit citado.

| Base | Registros da carga final | Horário de geração (Brasília) |
|---|---:|---|
| Presidência | 14 candidaturas | 10h09 |
| Governadores | 201 candidaturas | 10h09 |
| Senado | 319 candidaturas | 10h09 |
| Deputados federais | 7.803 candidaturas | 10h09 |
| Deputados estaduais/distritais | 11.728 candidaturas | 10h09 |
| **Total de candidaturas por cargo (somadas)** | **20.065** | **10h09** |
| Finanças de campanha | 17.170 candidaturas com registros financeiros | 10h11 |
| Patrimônio | 13.918 candidaturas e 77.446 bens declarados | 10h12 |

As contagens de candidaturas não são contagens de pessoas únicas. A soma não deve ser confundida com os 18.842 resultados conclusivos: são universos e critérios distintos.

## 4. Eleitorado apto e vagas

A referência do eleitorado é a base consolidada do TSE de **20/07/2026**, preservada em `src/election2026Facts.js`: **158.745.463 aptos**, dos quais **157.826.587** nas 27 UFs e **918.876** no exterior. A página `/entenda#eleitorado` apresenta a distribuição por UF; o painel de consulta combina eleitorado, candidaturas, vagas e razão aritmética por cargo e circunscrição.

Fonte: https://dadosabertos.tse.jus.br/dataset/eleitorado-2026

Vagas consideradas: Presidência 1; Governadores 27; Senado 54; Câmara 513; Assembleias/CLDF 1.059. Para Deputado Estadual/Distrital, o total de vagas é conferido com os resultados oficiais das 27 UFs. Candidaturas/vaga **não** representa probabilidade de eleição.

## 5. Validações e política de preservação

- `scripts/check_final_results_2026.mjs` valida 1.654 eleitos por cargo, os sete escopos efetivos do segundo turno, a conciliação do eleitorado e a correspondência exata de todos os eleitos com as bases de candidaturas.
- `scripts/check_navigation_build.mjs` e `scripts/smoke_preview.mjs` verificam rotas e artefatos do build, inclusive `/eleitos`.
- `scripts/check_accessibility_2026.mjs` verifica semântica básica, rótulos, mensagens de erro, foco visível e navegação. Não equivale a auditoria WCAG completa com tecnologia assistiva.
- O arquivo histórico **não deve incorporar automaticamente** alterações futuras do TSE. Uma retificação posterior depende de reabertura explícita, justificativa e novo commit auditável.
- **Publicação externa:** um commit no GitHub e um build bem-sucedido não comprovam deploy no Cloudflare Pages; verificar separadamente a rota pública.

A partir do encerramento definitivo, os workflows de coleta e atualização devem permanecer bloqueados e qualquer nova mudança exigir reabertura documentada.
