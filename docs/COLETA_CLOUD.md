# Coleta em nuvem — Eleições 2026 — Transparência Eleitoral

Última revisão: **05/09/2026**

Este documento descreve a operação normal de atualização das bases do projeto. A coleta principal **não depende de um computador pessoal ligado**: ela é executada por GitHub Actions, usa o Cloudflare Browser Worker quando necessário e publica os dados processados no repositório. O Cloudflare Pages publica a aplicação a partir da `main`.

## Arquitetura operacional

```text
Fontes oficiais
      │
      ├── TSE
      └── Câmara dos Deputados
      │
      ▼
Cloudflare Browser Worker
(quando o recurso exige navegação/browser)
      │
      ▼
GitHub Actions
      │
      ├── download
      ├── validação
      ├── processamento
      ├── geração de shards/agregados
      └── commit automático em data/processed
      │
      ▼
main
      │
      ▼
Cloudflare Pages
      │
      ▼
site público
```

O computador local permanece como **rota manual de contingência e desenvolvimento**, não como dependência do funcionamento normal do site.

## Matriz de atualização

Horários abaixo em **Brasília (UTC-3)**.

| Domínio | Workflow | Frequência programada | Processamento/publicação | Dependência do PC |
|---|---|---:|---|---:|
| Candidaturas TSE + cargos | `.github/workflows/coleta-online.yml` | 00:25, 06:25, 12:25 e 18:25 | GitHub Actions → `data/processed` → `main` | Não |
| Câmara — catálogo, identidade, histórico e atividade | `.github/workflows/coleta-online.yml` | junto da coleta acima | GitHub Actions → `data/processed` → `main` | Não |
| Prestação de contas / Finanças | `.github/workflows/coleta-financas-2026.yml` | 06:40 e 18:40 | GitHub Actions → `data/processed/financas-2026` → `main` | Não |
| Radar Eleitoral | `.github/workflows/coleta-financas-2026.yml` | junto de Finanças | compara snapshots editoriais e publica somente diferenças detectadas | Não |
| Siga o Dinheiro | `.github/workflows/coleta-financas-2026.yml` | junto de Finanças | reconstrói agregados editoriais | Não |
| Fornecedores | `.github/workflows/coleta-financas-2026.yml` | junto de Finanças | atualiza índice e entidades de fornecedor | Não |
| Patrimônio | `.github/workflows/coleta-patrimonio-2026.yml` | 07:20 | pipeline cloud diário; primeira ingestão real ainda em estabilização conforme `BACKLOG.md` / PR #19 | Não |
| Build/validação do frontend | `.github/workflows/update-data.yml` | push na `main`, PR e execução manual | valida coletores, processadores, build Vite e Worker | Não |
| Publicação do site | integração Git do Cloudflare Pages | após mudanças publicadas | build/deploy a partir do repositório | Não |
| Browser Worker | integração Git do Cloudflare | após mudanças do Worker | build/deploy do Worker; Wrangler é rota opcional quando os secrets estiverem configurados | Não |

## Candidaturas e Câmara

O workflow `coleta-online.yml` roda quatro vezes ao dia e executa, em sequência:

1. coleta de candidaturas do TSE via Cloudflare Browser Run;
2. geração das bases de Presidente, Governador, Senador e Deputado Estadual/Distrital;
3. reaplicação da camada histórica regional já existente;
4. atualização do catálogo da Câmara;
5. reconstrução do mapa de identidades TSE ↔ Câmara;
6. atualização do histórico parlamentar;
7. atualização da atividade parlamentar de 2023 a 2026;
8. commit dos arquivos modificados em `data/processed`.

Se não houver mudança, o workflow encerra sem criar commit de dados.

## Finanças e camada editorial

O workflow `coleta-financas-2026.yml` roda duas vezes ao dia. A mesma execução atualiza:

- prestação de contas eleitoral processada;
- shards financeiros por `SQ_CANDIDATO`;
- índice integral de fornecedores;
- visão agregada **Siga o Dinheiro**;
- páginas/entidades de fornecedores;
- snapshot editorial;
- **Radar Eleitoral**, com eventos somente quando uma diferença é detectada entre cargas comparáveis.

A publicação só ocorre depois das validações da carga financeira e da camada editorial.

## Patrimônio

O workflow `coleta-patrimonio-2026.yml` está programado para uma execução diária às 07:20. Ele foi projetado para coletar os recursos oficiais de bens, validar a carga e publicar os shards patrimoniais.

No estado documentado em 05/09/2026, a interface, o processador, a sanitização e o vínculo histórico conservador já estão implementados, mas a **primeira ingestão real de produção ainda está em estabilização**, acompanhada no PR #19 e no `BACKLOG.md`. O bloqueio operacional é tratado na própria automação cloud; não exige que um PC permaneça ligado.

## Validação e proteção da última base válida

Os pipelines são desenhados para não substituir silenciosamente uma base válida por uma coleta inválida. Dependendo do domínio, as verificações incluem:

- assinatura/estrutura do arquivo baixado;
- SHA-256 quando disponível no fluxo;
- presença de registros e shards esperados;
- consistência entre manifest e arquivos publicados;
- testes dos processadores no GitHub Actions;
- build do frontend;
- validação do Browser Worker.

Uma falha deve interromper a publicação daquele domínio em vez de transformar ausência ou erro de coleta em dado eleitoral publicado.

## Publicação no site

Quando um workflow produz alterações válidas, ele faz commit e push na `main`. A integração Git do Cloudflare Pages detecta a mudança e publica a nova versão do site.

Portanto, no fluxo normal:

```text
coleta agendada → validação → commit automático → main → Cloudflare Pages → produção
```

Não é necessário abrir o projeto localmente, executar `.bat` ou deixar um computador ligado.

## Coleta local / Windows

Os scripts Windows continuam no repositório por três razões:

1. contingência caso uma rota cloud esteja temporariamente indisponível;
2. reprodução/debug local;
3. desenvolvimento e validação manual dos coletores.

Eles **não são a fonte primária de atualização em produção**.

Documentação do fallback local: [`COLETA_WINDOWS.md`](COLETA_WINDOWS.md).

## Fonte de verdade operacional

- Estado das tarefas e pendências: [`BACKLOG.md`](BACKLOG.md)
- Direção por fases: [`ROADMAP.md`](ROADMAP.md)
- Coleta patrimonial: [`PATRIMONIO.md`](PATRIMONIO.md)
- Finanças: [`FINANCAS_ELEITORAIS_2026.md`](FINANCAS_ELEITORAIS_2026.md)

Sempre que frequência, workflow ou responsabilidade de publicação mudar, este documento deve ser atualizado no mesmo PR.