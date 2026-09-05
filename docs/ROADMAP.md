# Roadmap — Eleições 2026 — Transparência Eleitoral

Última revisão: **05/09/2026**

Este documento descreve a direção estratégica do projeto por fases. A execução concreta, prioridades, estado e vínculos com Issues/PRs ficam em [`BACKLOG.md`](BACKLOG.md).

A evolução deve sempre respeitar disponibilidade, qualidade e rastreabilidade das fontes oficiais, além dos princípios permanentes de neutralidade, simetria de tratamento e ausência de ranking/recomendação.

---

## Fase 1 — Produto de consulta

**Estado: ✅ concluída**

Objetivo: construir uma base pública estável para consultar candidaturas das Eleições 2026.

Entregas consolidadas:

- Home institucional, metodologia, fontes e página sobre o projeto.
- Consulta para Presidente, Governador, Senador, Deputado Federal e Deputado Estadual/Distrital.
- Filtros, busca, ordenação neutra e persistência em URL.
- Arquitetura leve para Deputado Estadual/Distrital por UF, em lotes e com índice sob demanda.
- Perfis individuais com navegação própria e histórico do navegador.
- Prestação de contas eleitoral em shards por candidatura.
- Integração conservadora com dados da Câmara dos Deputados quando a identidade é confirmada.
- Estados de carregamento, vazio e erro; melhorias de acessibilidade e navegação responsiva.
- CI, smoke tests e deploy automatizado no Cloudflare Pages.

Principais marcos: PRs #10, #14 e #15.

---

## Fase 2 — Editorial: transformar dados em descoberta

**Estado: 🚧 em andamento**

Objetivo: fazer o produto deixar de depender apenas de uma busca iniciada pelo usuário. Os próprios dados passam a criar rotas de descoberta, contexto e retorno recorrente.

### 2.1 Fundação editorial

**Estado: ✅ concluída**

- Radar Eleitoral baseado em diferenças entre cargas comparáveis.
- Siga o Dinheiro com visão agregada da prestação de contas.
- Diretório e páginas de fornecedores.
- Integração editorial na navegação e na Home.

Marco: PR #16.

### 2.2 Patrimônio e evolução patrimonial

**Estado: 🚧 funcionalidade entregue; primeira ingestão real em estabilização**

- Aba Patrimônio no perfil.
- Total declarado, composição por tipo e lista sanitizada.
- Redução de descrições potencialmente identificadoras.
- Vínculo histórico 2022 → 2026 apenas por assinatura conservadora e única.
- Pipeline e workflow próprios.

A primeira carga real ainda precisa ser publicada e validada na `main`; acompanhar o [`BACKLOG.md`](BACKLOG.md) e o PR #19.

Marco principal: PR #17.

### 2.3 Perfil público indexável / SEO estrutural

**Estado: ✅ concluída para perfis individuais**

- Pages Function para `/candidato/[id]`.
- HTML factual e metadata entregues antes do React.
- `title`, description, canonical, Open Graph e Twitter Card.
- 404/503 com `noindex` quando apropriado.
- Sitemap e `robots.txt` gerados no build.
- Índice SEO fragmentado para manter o projeto abaixo do limite de arquivos do Cloudflare Pages.

Marco: PR #20.

### 2.4 Malha editorial indexável

**Estado: 📋 próxima prioridade**

Criar páginas factuais e indexáveis que conectem os perfis individuais por:

- cargo;
- UF;
- partido;
- combinações de escopo estritamente necessárias e canonicalizadas.

Essas páginas devem criar navegação interna e contexto sem popularidade, ranking, score ou recomendação.

Issue: #21.

### 2.5 Confiança editorial e identidade pública

**Estado: 📋 backlog**

- Expediente.
- Política de correções e retificações.
- Domínio próprio e migração do canonical.
- Metadados do repositório GitHub.

---

## Fase 3 — Profundidade documental e dados públicos relacionados

**Estado: 🔎 pesquisa / backlog**

Objetivo: ampliar o perfil factual e a camada editorial sem perder rastreabilidade.

### Executivo

- Programas/propostas de governo de Presidente e Governador, quando houver fonte oficial adequada.
- Documento original preservado e data de coleta registrada.
- Estruturação temática somente com critérios uniformes e reproduzíveis.

### “O que ele fez?”

A camada Câmara já reúne parte relevante de histórico, despesas parlamentares, proposições e votos quando o vínculo de identidade é confirmado.

Próxima expansão:

- emendas parlamentares;
- Transferências Especiais do Transferegov;
- beneficiário, UF, município e código IBGE quando publicados;
- objeto/plano de trabalho declarado;
- relatório de gestão e documentos de execução publicados;
- trilha de rastreabilidade entre indicação, transferência e execução/documentação disponível.

Issue: #1.

### Senado Federal

- Pesquisar fontes oficiais adequadas para histórico, votações, proposições e atividade parlamentar.
- Definir correspondência de identidade conservadora antes de qualquer associação.

---

## Fase 4 — Escala, operação e produto sustentável

**Estado: 🔎 horizonte futuro**

Objetivo: transformar a infraestrutura criada para o ciclo eleitoral em um produto de dados sustentável e reutilizável.

Possíveis frentes:

- API pública versionada.
- Observabilidade pública das últimas cargas válidas.
- Alertas automáticos para mudanças de schema nas fontes oficiais.
- Conteúdo explicativo programático apoiado na metodologia do projeto.
- Monitoramento de distribuição e aquisição orgânica.
- Estruturas de parceria ou sustentabilidade que preservem independência editorial e auditabilidade.

Nenhuma dessas frentes deve comprometer os princípios de neutralidade, transparência de fonte ou tratamento simétrico dos registros.

---

## Itens suspensos / experimentais

### Comparador de candidaturas

Fora da prioridade atual. O produto permanece centrado em perfis individuais e navegação factual. Qualquer retomada exigirá nova revisão explícita de escopo e metodologia.

### Regionalização histórica por DDD

Permanece experimental. Nunca apresentar como domicílio eleitoral, residência, endereço ou área atual de atuação política.

---

## Princípios permanentes

- Fontes oficiais identificadas.
- Neutralidade político-partidária.
- Sem ranking, nota, selo ou recomendação de candidaturas.
- Mesmos campos e regras de exibição quando o mesmo tipo de dado estiver disponível.
- Correspondências entre bases somente quando a metodologia considerar a identidade segura.
- Ausência de dado significa ausência de confirmação/publicação na fonte consultada, não ausência do fato no mundo real.
- Valores financeiros e patrimoniais são apresentados de forma descritiva.
- Toda visualização deve informar período, fonte e escopo do dado exibido.
- Falha de coleta não deve sobrescrever automaticamente a última base válida.
- Decisões de planejamento devem permanecer versionadas em Git.
