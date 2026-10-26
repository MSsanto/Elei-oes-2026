# Bloqueio de reabertura — arquivo Eleições 2026

**Estado:** ARQUIVADO / CONGELADO em 26/10/2026, após o segundo turno e a atualização final das bases.  
**Último commit de dados oficiais:** `8098ac3f62c51f49358cf1fbbffc6a1685a9fb2e`.  
**Snapshot de resultados:** `data/processed/resultados-2026/status-por-candidato.json`, blob SHA `7f4b62adab793bd89abbdc084c924a5b22d2c92a`.  
**Registro detalhado:** `docs/SNAPSHOT_FINAL_2026.md`.

## O que está bloqueado

Os workflows de coleta de candidaturas, finanças, patrimônio, resultados, histórico regional, deploy do Browser Worker, publicação no Pages, atualização final única, watchdog e PoC de vídeo foram mantidos no GitHub para auditoria, porém **sem gatilhos automáticos e com `jobs.<job>.if: false`**. Permissões de escrita em `contents` foram removidas dos workflows arquivados.

O workflow de CI `Validar projeto` e as validações de código de situação de candidaturas continuam como verificações não mutantes em PR/push; eles não coletam, não alteram bases e não publicam o site.

Os scripts locais de coleta e instalação de tarefa agendada no Windows recusam executar enquanto este arquivo existir. **Uma tarefa já instalada no Windows de uma máquina do usuário não pode ser removida remotamente pelo GitHub.** Na máquina em questão, executar `REMOVER_ATUALIZACAO_AUTOMATICA.bat` e confirmar que a tarefa `Eleicoes2026-Coletor-TSE` foi excluída. O bloqueio em código só terá efeito depois de atualizar o checkout local.

O `workers/tse-browser-probe/wrangler.jsonc` não declara cron. Gatilhos externos configurados diretamente no painel Cloudflare e a integração nativa de deploy do Pages não são administrados por estes arquivos; devem ser conferidos separadamente na conta.

## Regra de reabertura

A validação de CI `scripts/check_reopen_policy_2026.mjs` exige `docs/REABERTURA_2026.md` em qualquer PR/push posterior ao commit de congelamento, com os campos `Autorização explícita:`, `Responsável:`, `Escopo:`, `Justificativa:` e `Data:`. Isso é uma trava auditável, não substitui revisão humana ou proteção administrativa da branch.

Nenhuma coleta, atualização, publicação, mudança de resultado ou funcionalidade deve ocorrer por rotina. Uma retomada exige **pedido explícito**, com escopo e justificativa registrados em issue/PR, revisão das fontes oficiais e dos riscos de reprocessamento, alteração consciente do bloqueio dos workflows necessários, execução de testes e documentação de novo snapshot e novo commit. Não remover este marcador apenas para fazer um deploy ou uma coleta incidental.

**Publicação excepcional homologada — 26/10/2026:** a falha original de credenciais (run 40329675282) e de versão pública anterior (run 40330042233) foi resolvida. O projeto Pages existente `eleicoes-2026`, domínio `eleicoes-2026-ebz.pages.dev`, recebeu 5.338 arquivos e teve as rotas `/encerramento-2026` e `/eleitos` verificadas por HTTP na [execução 40359713307](https://github.com/MSsanto/Elei-oes-2026/actions/runs/40359713307). A reabertura foi restrita a esta publicação, documentada em [`REABERTURA_2026.md`](REABERTURA_2026.md) e [`PUBLICACAO_PAGES_2026.md`](PUBLICACAO_PAGES_2026.md). O workflow excepcional está novamente desativado (`workflow_dispatch` e `if: false`), assim como as coletas e demais publicações automáticas.

Este arquivo não altera o caráter independente e apartidário do projeto. Resultados de 26/10/2026 são um retrato histórico, não uma declaração de que decisões judiciais futuras não ocorrerão.

## Adição final de votos nominais — 26/10/2026

Mediante autorização explícita do mantenedor, foi realizado o enriquecimento pontual do snapshot com os votos nominais publicados pelo TSE. A homologação [40370961449](https://github.com/MSsanto/Elei-oes-2026/actions/runs/40370961449) confirmou **18.842/18.842 candidaturas com votos**, sem alterar as situações e mantendo 1.654 eleitas/eleitos. O deploy Pages foi concluído e confirmado por HTTP no domínio original.

O workflow excepcional `publicar-votos-2026-uma-vez.yml` está agora com gatilho exclusivamente manual, `if: false` e permissão `contents: read`, e integra `scripts/check_freeze_2026.mjs`. Nenhuma rotina de atualização dos votos ficou habilitada. Detalhes de escopo e homologação em [`REABERTURA_2026.md`](REABERTURA_2026.md).
