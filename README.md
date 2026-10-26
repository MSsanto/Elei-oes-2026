# Eleições 2026 — Transparência de Campanhas e Mandatos

> **Arquivo histórico congelado — 26/10/2026:** atualização final de candidaturas, finanças, patrimônio e resultados oficiais concluída com sucesso. O snapshot contém **1.654 eleitas e eleitos** em **116 arquivos oficiais do TSE**, com dados preservados no commit `8098ac3f62c51f49358cf1fbbffc6a1685a9fb2e`. Coletas, watchdogs e deploys por workflow estão bloqueados; mudanças futuras exigem reabertura explícita. Ver [snapshot final](docs/SNAPSHOT_FINAL_2026.md), [trava de arquivo](docs/ARCHIVE_LOCK_2026.md) e [encerramento](docs/ENCERRAMENTO_2026.md).

Projeto open source para organizar e tornar mais acessíveis dados públicos eleitorais e parlamentares das **Eleições 2026**.

**Site:** https://eleicoes-2026-ebz.pages.dev

**Encerramento público do projeto 2026:** [ver as entregas e o registro de conclusão](https://eleicoes-2026-ebz.pages.dev/encerramento-2026). A interface documenta as entregas do ciclo, e o resultado final de 26/10 está registrado separadamente no GitHub. A versão final foi publicada e verificada em 26/10/2026 na [execução 40359713307](https://github.com/MSsanto/Elei-oes-2026/actions/runs/40359713307).

## Resultado eleitoral na pesquisa

A consulta pode exibir **Eleito**, **Não eleito** e **Não confirmado** ao lado do nome de cada candidatura. Esses marcadores são distintos da situação do registro eleitoral (`deferido`, `indeferido` etc.) e dependem da totalização oficial do TSE ligada ao identificador `SQ_CANDIDATO`.

A fonte do snapshot é `data/processed/resultados-2026/status-por-candidato.json`. A rota **`/eleitos`** oferece consulta neutra às pessoas eleitas, por cargo e UF, e as consultas por candidatura mostram **Eleito / Não eleito / Não confirmado**. O pipeline de importação foi preservado para auditoria, mas está bloqueado pelo encerramento. Consulte [`docs/RESULTADOS_ELEITORAIS_2026.md`](docs/RESULTADOS_ELEITORAIS_2026.md).

**Publicação externa homologada — 26/10/2026:** após a configuração das credenciais, a [execução 40359713307](https://github.com/MSsanto/Elei-oes-2026/actions/runs/40359713307) publicou 5.338 arquivos no projeto Pages `eleicoes-2026` e validou por HTTP `/encerramento-2026`, `/eleitos` e o bundle da aplicação. O workflow pontual foi novamente bloqueado depois do deploy. Ver [relatório de publicação](docs/PUBLICACAO_PAGES_2026.md) e [reabertura limitada](docs/REABERTURA_2026.md).

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

- TSE — Candidaturas e Bens de candidatos 2026: `https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026`
- TSE — DivulgaCandContas, fonte secundária de conferência por candidatura: `https://divulgacandcontas.tse.jus.br/divulga/#/`
- TSE — Candidaturas e Bens de candidatos 2022, para histórico conservador: `https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2022`
- TSE — Prestação de Contas Eleitorais 2026: `https://dadosabertos.tse.jus.br/pt_BR/dataset/prestacao-de-contas-eleitorais-2026`
- Câmara dos Deputados — Dados Abertos: `https://dadosabertos.camara.leg.br/swagger/api.html`
- Transferegov.br — Dados Abertos: `https://api-publica.transferegov.gestao.gov.br/`
- Transferegov.br — Transferências Especiais: `https://docs.api.transferegov.gestao.gov.br/transferenciasespeciais/`

Catálogo legível por máquina: [`config/fontes_oficiais.json`](config/fontes_oficiais.json)

## Patrimônio declarado

A camada patrimonial usa o recurso oficial **Bens de candidatos** do TSE e publica arquivos processados em `data/processed/patrimonio-2026/`.

- os perfis são divididos em 256 shards usando `SQ_CANDIDATO`, como a camada financeira;
- o frontend só baixa o shard da candidatura quando a aba **Patrimônio** é aberta;
- valores são exibidos nominalmente, sem estimativa de preço de mercado, correção monetária, nota ou classificação;
- composição por tipo de bem usa a classificação publicada pelo TSE;
- ausência de registro na carga é apresentada como ausência de localização, não como afirmação de patrimônio zero;
- descrições com padrões de endereço, conta/agência, documentos, telefone, CEP, placas, matrículas e identificadores extensos são reduzidas antes da publicação na interface;
- a categoria e o valor continuam preservados mesmo quando a descrição é reduzida.

A primeira carga real foi validada e publicada em **05/09/2026**, com **13.843 candidaturas**, **76.806 registros de bens** e **4.019 vínculos históricos 2022 → 2026** confirmados pela metodologia conservadora. O diagnóstico das fontes e a correção operacional estão em [`docs/PATRIMONIO_FONTES.md`](docs/PATRIMONIO_FONTES.md).

### Histórico de declarações patrimoniais — 2022 e 2026

O projeto não associa candidaturas de eleições diferentes somente pelo nome. O histórico é exibido apenas quando **nome civil + data de nascimento + gênero** formam uma assinatura normalizada, exata e única nas duas eleições.

Quando o vínculo é confirmado, a interface apresenta as declarações em ordem cronológica e identifica separadamente **2022 — declaração histórica localizada** e **2026 — candidatura atual**. Cada valor corresponde ao total nominal declarado na respectiva eleição.

A existência de uma declaração anterior comprova o registro daquela candidatura e de seus bens no conjunto oficial consultado, mas não é usada isoladamente para afirmar eleição ou exercício de mandato. Informações de mandato permanecem em módulo próprio e dependem de fonte parlamentar correspondente.

A interface não calcula percentual de aumento ou redução, diferença patrimonial agregada, ranking, score, correção monetária automática, estimativa de mercado ou conclusão sobre origem de recursos ou eventual irregularidade.

Metodologia detalhada: [`docs/HISTORICO_PATRIMONIAL.md`](docs/HISTORICO_PATRIMONIAL.md).

Pipeline:

```text
TSE — Candidatos 2026
 └── bem_candidato_2026.zip
             │
             ├───────────────┐
             │               │
TSE — Candidatos 2022       │
 ├── consulta_cand_2022.zip │
 └── bem_candidato_2022.zip │
             │               │
             ▼               ▼
      Browser Worker / validação ZIP + SHA-256
                       │
                       ▼
             processamento offline
       agregação + privacidade + vínculo histórico
                       │
                       ▼
         patrimonio-2026 / shards por candidato
                       │
                       ▼
                aba Patrimônio
```

O workflow histórico de patrimônio está em `.github/workflows/coleta-patrimonio-2026.yml`, **bloqueado** após o snapshot final de 26/10/2026 (13.918 candidaturas, 77.446 bens e 4.034 vínculos históricos).

## Arquitetura resumida

```text
                 TSE
                  │
                  ├── candidaturas / bens / contas
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

A integração com Transferegov permanece como expansão planejada; consulte o backlog para o estado atual.

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

A operação normal é **cloud-first** e não depende de um computador pessoal ligado.

```text
Fontes oficiais
 │
 ▼
Cloudflare Browser Worker (quando necessário)
 │
 ▼
GitHub Actions
 │ download / validação / processamento
 │
 ▼
data/processed → commit automático na main
 │
 ▼
Cloudflare Pages
 │
 ▼
Site público
```

As candidaturas e os dados da Câmara são coletados quatro vezes ao dia; Finanças e a camada editorial, duas vezes ao dia; Patrimônio possui workflow diário próprio. Frequências, responsabilidades, validações e estado operacional estão documentados em [`docs/COLETA_CLOUD.md`](docs/COLETA_CLOUD.md).

Os primeiros testes receberam HTTP 403 do TSE em acessos automatizados. Por isso, o pipeline usa um Browser Worker dedicado quando necessário. GitHub Actions executa as transformações e validações antes de publicar alterações na `main`.

## Fallback local / Windows

Os scripts Windows permanecem como **rota manual de contingência, reprodução e desenvolvimento**. Eles não são necessários para que as atualizações programadas de produção continuem rodando.

Depois de clonar o repositório, a coleta manual pode ser executada com:

`COLETAR_E_PUBLICAR.bat`

A instalação de tarefa local com `INSTALAR_ATUALIZACAO_AUTOMATICA.bat` é uma alternativa opcional e não a fonte primária de atualização em produção.

Documentação operacional cloud: [`docs/COLETA_CLOUD.md`](docs/COLETA_CLOUD.md)  
Documentação do fallback Windows: [`docs/COLETA_WINDOWS.md`](docs/COLETA_WINDOWS.md)

## Planejamento e governança

O planejamento do projeto também é versionado em Git.

- **[`docs/BACKLOG.md`](docs/BACKLOG.md)** — fonte canônica operacional: prioridades, tarefas, estado, Issues e PRs relacionados.
- **[`docs/ROADMAP.md`](docs/ROADMAP.md)** — direção estratégica por fases.

Convenção operacional:

- ✅ concluído: entregue na `main` e validado;
- 🚧 em andamento: implementação ou validação operacional aberta;
- 📋 backlog: trabalho aprovado ainda não iniciado;
- 🔎 pesquisa: hipótese dependente de fonte, arquitetura ou escopo;
- 🧊 suspenso: preservado historicamente, mas fora da prioridade atual.

Mudanças relevantes de escopo ou prioridade devem atualizar o `BACKLOG.md` no mesmo PR sempre que possível. Entregas concluídas permanecem registradas com referências históricas; não são apagadas silenciosamente.

> Projeto independente, sem vínculo com TSE, Câmara dos Deputados, Transferegov.br, partidos ou candidatos.
