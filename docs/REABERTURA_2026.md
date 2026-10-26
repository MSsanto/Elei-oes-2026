# Reabertura excepcional para publicação do arquivo eleitoral 2026

**Autorização explícita:** O responsável pelo projeto solicitou colocar a versão final do site no ar, confirmou o cadastro do API Token e informou a correção do Account ID do Cloudflare no GitHub, em conversa de 26/10/2026.

**Responsável:** Mantenedor do repositório `MSsanto/Elei-oes-2026`.

**Escopo:** Executar uma única publicação do artefato web já versionado e validado, que inclui a página `/encerramento-2026`, a consulta `/eleitos` e os marcadores de situação eleitoral na pesquisa, no projeto Cloudflare Pages existente `eleicoes-2026-ebz.pages.dev`. Conferir a publicação na URL pública.

**Justificativa:** As versões implementadas no repositório não tinham sido disponibilizadas em produção porque o fluxo de publicação estava desativado e, depois, as credenciais do Cloudflare estavam incorretas. O usuário corrigiu o Account ID e pediu continuidade da entrega.

**Data:** 26/10/2026.

## Limites da autorização

- O congelamento dos dados, scripts e pipelines periódicos permanece em vigor.
- Esta exceção **não autoriza** coletar, editar, substituir ou reinterpretar resultados eleitorais.
- Não autoriza criar outro projeto Pages nem publicar em outro domínio.
- O workflow excepcional deve ser desativado após o deploy e a verificação pública, com a operação e resultado documentados no GitHub.
- Caso haja falha de identificação de projeto, autenticação ou publicação, interromper e registrar o erro sem alegar sucesso.

**Referência ao pedido:** conversa de 26/10/2026; reabertura restrita ao deploy final solicitado, sem retomada do desenvolvimento.

## Resultado da exceção

**Concluída em 26/10/2026:** publicação de produção executada no projeto Pages existente; upload de 5.338 arquivos; rotas `/encerramento-2026` e `/eleitos` e bundle confirmados por HTTP. Log: https://github.com/MSsanto/Elei-oes-2026/actions/runs/40359713307 .

A adequação técnica ao limite de 25 MiB do Cloudflare Pages está documentada em [`PUBLICACAO_PAGES_2026.md`](PUBLICACAO_PAGES_2026.md). Os dados integrais permanecem preservados em `data/processed`.

A rotina de publicação excepcional foi desativada após o sucesso (`workflow_dispatch` com `if: false`). Nenhuma coleta automática foi reativada.

## Última exceção: apresentar quantidade de votos

**Autorização explícita:** em 26/10/2026, o mantenedor solicitou acrescentar a quantidade de votos nominais às identificações **Eleito / Não eleito**, incluindo as consultas e a página de eleitas e eleitos, como último ajuste do projeto.

**Responsável:** mantenedor do repositório `MSsanto/Elei-oes-2026`.

**Escopo:** acrescentar exclusivamente os votos nominais oficiais (`cand.vap`) e o turno eleitoral a cada `SQ_CANDIDATO` já presente no snapshot de resultados; atualizar a interface e realizar uma publicação pontual no projeto Cloudflare Pages existente `eleicoes-2026`. **Não** alterar situações eleitorais, totais de eleitos, candidaturas, receitas, despesas ou patrimônios.

**Justificativa:** a versão publicada permite consultar o resultado Eleito / Não eleito, mas não mostra quantos votos recebeu cada candidatura. Exibir essa informação torna o arquivo eleitoral mais completo e auditável.

**Data:** 26/10/2026.

A execução excepcional está definida em `.github/workflows/publicar-votos-2026-uma-vez.yml`. Ela usa exclusivamente os **116 arquivos oficiais já relacionados no snapshot arquivado**, testa as regras, interrompe se houver divergência de situação ou cobertura insuficiente, atualiza somente campos de votos/turno, versiona a mudança, faz o build, verifica o projeto/domínio Cloudflare e homologará a publicação por HTTP. Após a homologação o workflow será bloqueado novamente. Nenhuma coleta periódica será ativada.
