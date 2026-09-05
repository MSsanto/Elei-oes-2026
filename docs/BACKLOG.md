# Backlog — Eleições 2026 — Transparência Eleitoral

Última revisão: **05/09/2026**  
Fase atual: **Fase 2 — Editorial**  
Fonte canônica do trabalho planejado: **este arquivo**.

O `BACKLOG.md` registra tarefas concretas, prioridades, estado e vínculos com Issues/PRs. O [`ROADMAP.md`](ROADMAP.md) descreve a direção estratégica por fases.

## Convenção de estados

- ✅ **Concluído** — entregue na `main`; sempre que possível, referenciar PR ou commit.
- 🚧 **Em andamento** — implementação ou validação operacional aberta; referenciar Issue/PR/branch.
- 📋 **Backlog** — trabalho aprovado, ainda não iniciado.
- 🔎 **Pesquisa** — hipótese que ainda depende de fonte, arquitetura ou escopo editorial.
- 🧊 **Suspenso** — registrado historicamente, mas fora da prioridade/escopo atual.

## Regras de manutenção

1. Mudanças de prioridade, inclusão, remoção ou conclusão devem passar por commit/PR.
2. Uma entrega só passa para ✅ quando estiver na `main` e o comportamento relevante tiver sido validado.
3. Issues detalham implementação; este documento permanece como visão operacional consolidada.
4. Tarefas concluídas devem manter referência histórica em vez de serem apagadas.
5. Mudanças de fonte oficial ou de metodologia devem atualizar também a documentação específica correspondente.

---

## 🚧 Em andamento

Nenhuma entrega da fundação editorial está em validação operacional neste momento. Novos trabalhos entram nesta seção quando houver Issue/PR/branch ativo.

---

## 📋 Próximas prioridades

### P1 — SEO editorial: páginas por cargo, UF e partido

Issue: [#21 — SEO editorial — páginas indexáveis por cargo, UF e partido](https://github.com/MSsanto/Elei-oes-2026/issues/21)

- [ ] Rotas indexáveis por cargo.
- [ ] Rotas por cargo + UF quando aplicável.
- [ ] Rotas por partido com escopo claro.
- [ ] Links internos agregador → perfil e perfil → agregadores.
- [ ] `title`, `description`, canonical e Open Graph server-side.
- [ ] Inclusão das novas rotas no sitemap.
- [ ] Regras para evitar conteúdo duplicado por combinações de filtros.
- [ ] Preservar a arquitetura leve de Deputado Estadual/Distrital.
- [ ] Smoke tests de rota, canonical, sitemap e navegação interna.

A ordenação padrão deve continuar neutra: **Nome A–Z**. Não criar popularidade, score, selo ou recomendação.

### P2 — Expediente e política de correções

- [ ] Criar página pública de expediente.
- [ ] Criar política de correções e retificações.
- [ ] Definir campos mínimos de uma correção: data, conteúdo afetado, motivo, fonte e versão/commit quando aplicável.
- [ ] Definir como correções relevantes aparecem no site e no repositório.
- [ ] Ligar `/sobre`, `/metodologia` e a política de correções entre si.

### P3 — Domínio próprio

- [ ] Definir domínio canônico do projeto.
- [ ] Configurar domínio no Cloudflare Pages.
- [ ] Atualizar `SITE_ORIGIN`, canonical, Open Graph, sitemap e `robots.txt`.
- [ ] Configurar redirecionamento permanente do domínio `pages.dev` para o domínio canônico, quando seguro.
- [ ] Atualizar README, GitHub About e referências públicas.

### P4 — Programas/propostas de governo para Executivo

Escopo futuro para Presidente e Governador, condicionado a documentos oficiais disponíveis.

- [ ] Catalogar fonte oficial dos programas/propostas.
- [ ] Preservar documento original e data da coleta.
- [ ] Estruturar navegação por tema apenas quando a classificação puder ser aplicada de forma uniforme e reproduzível.
- [ ] Exibir conteúdo de maneira descritiva, sem nota, ranking, recomendação ou juízo de mérito.
- [ ] Documentar metodologia antes da publicação.

### P5 — “O que ele fez?”: emendas e Transferências Especiais

Issue: [#1 — O que ele fez? — integrar Câmara e Transferências Especiais](https://github.com/MSsanto/Elei-oes-2026/issues/1)

A camada Câmara já possui histórico, despesas parlamentares, proposições e votos quando a correspondência de identidade é confirmada. O bloco ainda pendente é principalmente a expansão para emendas e transferências.

- [ ] Integrar emendas parlamentares.
- [ ] Integrar API de Transferências Especiais do Transferegov.
- [ ] Indexar beneficiário, UF, município e código IBGE quando publicados.
- [ ] Registrar plano de trabalho/objeto declarado.
- [ ] Registrar relatório de gestão e documentos de execução publicados.
- [ ] Criar trilha de rastreabilidade entre indicação, transferência, objeto declarado e execução/documentos publicados.

Nunca inferir destino final de verba quando a fonte oficial não o comprovar.

### P6 — Metadados do repositório GitHub

- [ ] Preencher **Description** do About.
- [ ] Preencher **Website** com o domínio canônico atual.
- [ ] Adicionar topics relevantes (`eleicoes-2026`, `transparencia`, `tse`, `dados-abertos`, `react`, `cloudflare-pages`, `civic-tech`, entre outros).

Essa configuração é externa aos arquivos versionados, mas permanece no backlog para não ser esquecida.

---

## 📋 Engenharia e confiabilidade

### Testes de navegador

- [ ] Adicionar E2E em navegador real para rotas críticas e histórico Back/Forward.
- [ ] Cobrir 320/375/768/1024/1440 px e zoom de 200% em uma matriz mínima de regressão visual/manual.

### Dependências

- [ ] Fixar versões de dependências e manter lockfile consistente.
- [ ] Revisar as vulnerabilidades conhecidas da árvore do Browser Worker sem aplicar `--force` cegamente.

### Frontend legado

- [ ] Verificar e remover somente após prova de não uso arquivos/bootstrap legados ainda presentes.
- [ ] Migrar qualquer auditoria restante baseada em `MutationObserver` para React nativo antes de remover o código legado.

### Observabilidade dos dados

- [x] Documentar a matriz operacional de coleta cloud, frequências, workflows, publicação automática e fallback local — [`COLETA_CLOUD.md`](COLETA_CLOUD.md).
- [ ] Alertar quando uma fonte oficial mudar schema/colunas esperadas.
- [ ] Registrar versão/hashes de cada carga de forma uniforme entre domínios.
- [ ] Criar status público simples das últimas cargas válidas por fonte.

---

## 🔎 Pesquisa / etapas posteriores

### API pública versionada

- [ ] Definir escopo mínimo e contrato de versão.
- [ ] Separar API pública de arquivos internos de processamento.
- [ ] Definir limites/cache e documentação pública.

### Camada editorial programática

- [ ] Explicadores baseados em metodologia: como ler prestação de contas, patrimônio e situações publicadas.
- [ ] Páginas temáticas agregadas somente quando os critérios puderem ser simétricos e reproduzíveis.
- [ ] Integração entre Radar e páginas explicativas sem transformar alteração de dado em suspeita ou juízo.

### Senado Federal

- [ ] Pesquisar fonte oficial adequada para histórico, votações, proposições e atividade parlamentar.
- [ ] Definir correspondência de identidade conservadora antes de associar dados a candidaturas.

---

## 🧊 Suspenso / fora da prioridade atual

### Comparador de candidaturas

Não implementar no escopo atual. O produto permanece centrado em perfis individuais e navegação factual, com os mesmos campos e critérios de apresentação. Qualquer retomada futura exigiria revisão explícita de escopo e metodologia antes de desenvolvimento.

### Regionalização histórica por DDD

Permanece experimental. Nunca apresentar como domicílio eleitoral, residência, endereço ou área atual de atuação política.

---

## ✅ Entregas consolidadas

### Fase 1 — Produto de consulta

- ✅ Home institucional e neutra — PR [#10](https://github.com/MSsanto/Elei-oes-2026/pull/10).
- ✅ UX, navegação, filtros e perfil dedicado — PRs [#11](https://github.com/MSsanto/Elei-oes-2026/pull/11), [#14](https://github.com/MSsanto/Elei-oes-2026/pull/14) e [#15](https://github.com/MSsanto/Elei-oes-2026/pull/15).
- ✅ Cinco cargos publicados, incluindo Deputado Estadual/Distrital com carga por UF, lotes de 60, índice de busca sob demanda, cache e carregamento incremental.
- ✅ Perfil com Resumo, Finanças e atuação parlamentar quando aplicável.
- ✅ Metodologia, Fontes e Sobre.

### Fase 2 — Fundação editorial

- ✅ Radar Eleitoral — PR [#16](https://github.com/MSsanto/Elei-oes-2026/pull/16).
- ✅ Siga o Dinheiro — PR [#16](https://github.com/MSsanto/Elei-oes-2026/pull/16).
- ✅ Diretório e páginas de fornecedor — PR [#16](https://github.com/MSsanto/Elei-oes-2026/pull/16).
- ✅ Patrimônio: interface/pipeline no PR [#17](https://github.com/MSsanto/Elei-oes-2026/pull/17), correção operacional e fonte oficial secundária no PR [#24](https://github.com/MSsanto/Elei-oes-2026/pull/24), com primeira carga real publicada no commit `6218591f4bd8862f88f86bce20cfe35017a952ba` — **13.843 candidaturas, 76.806 bens e 4.019 vínculos históricos**.
- ✅ Perfis individuais com HTML/metadata server-side, Open Graph, canonical, sitemap e `robots.txt` — PR [#20](https://github.com/MSsanto/Elei-oes-2026/pull/20).
- ✅ Build SEO atual: **19.988 perfis em 100 shards**, com proteção contra o limite de arquivos do Cloudflare Pages.

### Operação e governança

- ✅ `BACKLOG.md` como fonte canônica operacional e `ROADMAP.md` por fases — PR [#22](https://github.com/MSsanto/Elei-oes-2026/pull/22).
- ✅ Coleta principal documentada como cloud-first; Windows mantido como fallback manual — [`COLETA_CLOUD.md`](COLETA_CLOUD.md).
- ✅ Diagnóstico e hierarquia de fontes patrimoniais documentados — [`PATRIMONIO_FONTES.md`](PATRIMONIO_FONTES.md).

---

## Histórico

O histórico detalhado deste backlog é o próprio histórico Git do arquivo. Para cada mudança relevante, use o commit/PR correspondente; não reescreva silenciosamente decisões antigas.