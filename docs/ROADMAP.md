# Roadmap — Eleições 2026 — Transparência Eleitoral

Este documento registra ideias aprovadas para evolução do projeto. A ordem abaixo é orientativa e deve respeitar a disponibilidade e a qualidade das fontes oficiais.

## 1. Evolução imediata da experiência

- Ordenação por nome, número e partido.
- Filtro por ocupação/profissão.
- Link direto para o repositório no topo e no rodapé.
- Compartilhamento de perfis por deep link.
- Rolagem infinita em lotes, com fallback de “carregar mais”.
- Destaque visual para candidaturas com histórico confirmado na Câmara.
- Empty state com orientação para revisar a grafia ou limpar filtros.

## 2. Perfis com visualizações de dados

Ao abrir um perfil, evoluir o modal para um painel visual com gráficos baseados exclusivamente em dados oficiais e com escopo/metodologia explícitos.

### Câmara dos Deputados

- Histórico de exercício parlamentar.
- Votações/posicionamentos individuais publicados pela Câmara.
- Despesas do mandato, sempre identificadas como despesas parlamentares e nunca como despesas de campanha.
- Proposições de autoria publicadas pela Câmara.

### Senado Federal

- Integrar histórico parlamentar apenas por correspondência segura com a fonte oficial do Senado.
- Votações, proposições e atividade parlamentar devem informar período e escopo da carga.
- Não inferir que toda candidatura a Senador possui histórico no Senado.

### TSE — campanha e patrimônio

Adicionar somente quando a coleta oficial correspondente estiver consolidada:

- Receitas e despesas de campanha.
- Evolução patrimonial declarada entre eleições, quando houver correspondência de identidade segura entre os pleitos.
- Fontes e período de referência visíveis em cada gráfico.

O projeto não deve transformar valores em nota, ranking, recomendação ou julgamento político.

## 3. Arquitetura multi-cargo

O frontend e a camada processada já suportam múltiplos cargos com filtros dinâmicos e persistência na URL.

### Implementado

1. Presidente — circunscrição nacional, sem filtro de UF.
2. Governador — carga sob demanda por UF.
3. Senador — carga sob demanda por UF.
4. Deputado Federal — suporte existente, incluindo integração conservadora com histórico da Câmara.

### Próximas extensões

- Vice-Presidente como composição da candidatura presidencial, conforme estrutura oficial do TSE.
- Vice-Governador como composição da candidatura estadual.
- 1º e 2º suplentes de Senador como composição da candidatura ao Senado, sem tratá-los como candidaturas independentes quando a fonte oficial permitir o vínculo seguro.
- Histórico parlamentar oficial do Senado.
- Deputado Estadual/Distrital com fragmentação/paginação real por UF.

Estrutura conceitual:

```text
/candidatos
  /presidente
  /governador
  /senador
  /deputado-federal
  /deputado-estadual
```

Cada perfil deve manter uma chave estável da fonte oficial e receber módulos opcionais conforme o cargo e o histórico localizado, por exemplo Câmara para deputados e Senado para senadores.

## 4. Navegação

A navegação multi-cargo segue a estrutura:

```text
Presidente | Governador | Senador | Deputado Federal | Deputado Estadual
```

Deputado Estadual permanece pendente. Para cargos de circunscrição estadual, a consulta deve usar:

```text
UF → Partido → Ocupação → Nome/Número
```

## 5. Backlog experimental

### Regionalização histórica por DDD

A investigação mostrou que o município de domicílio eleitoral não está disponível de forma adequada nas fontes públicas consultadas. A alternativa baseada na distribuição histórica dos votos de 2022 permanece em backlog experimental.

Nunca apresentar essa informação como “DDD do domicílio eleitoral”, residência, endereço ou área atual de atuação política.

## Princípios permanentes

- Fontes oficiais identificadas.
- Neutralidade político-partidária.
- Sem ranking ou recomendação de candidaturas.
- Correspondências entre bases somente quando a metodologia considerar a identidade segura.
- Ausência de dado significa ausência de confirmação/publicação na fonte consultada, não ausência do fato no mundo real.
- Toda visualização deve informar período, fonte e escopo do dado exibido.
