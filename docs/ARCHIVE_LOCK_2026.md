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

**Bloqueio de publicação constatado:** o workflow de deploy final falhou na verificação de credenciais Cloudflare (run 40329675282). A checagem pública (run 40330042233) confirmou versão antiga no domínio. Nenhum deploy foi declarado como concluído. O eventual fornecimento de credenciais e publicação deve ocorrer em reabertura explícita, sem reativar coletas.

Este arquivo não altera o caráter independente e apartidário do projeto. Resultados de 26/10/2026 são um retrato histórico, não uma declaração de que decisões judiciais futuras não ocorrerão.
