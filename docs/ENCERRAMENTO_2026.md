# Encerramento definitivo — Eleições 2026 · Transparência Eleitoral

**Decisão inicial:** 22/10/2026 (suspensão das coletas recorrentes).  
**Segundo turno:** 25/10/2026.  
**Última coleta oficial:** 26/10/2026, concluída com sucesso.  
**Estado do repositório após o encerramento:** arquivo histórico congelado.  
**Snapshot:** [SNAPSHOT_FINAL_2026.md](SNAPSHOT_FINAL_2026.md).  
**Bloqueio operacional:** [ARCHIVE_LOCK_2026.md](ARCHIVE_LOCK_2026.md).

## 1. Resultado oficial e atualização final

Em 26/10, o TSE confirmou a reeleição de Lula à Presidência e os seis resultados de governo decididos no segundo turno (AC, AM, DF, ES, RN e TO). A totalização arquivada contém **1.654 eleitas e eleitos**: 1 Presidente, 27 Governadores, 54 Senadores, 513 Deputados Federais e 1.059 Deputados Estaduais/Distritais. Os **116 arquivos oficiais** de resultados validados abrangem 18.842 candidaturas com situação conclusiva. Os 21 arquivos de segundo turno ausentes referem-se a UFs onde não houve nova votação para governador.

Fontes: https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/presidente-do-tse-anuncia-reeleicao-de-lula-e-faz-balanco-do-2o-turno-das-eleicoes-2026 e https://resultados.tse.jus.br/

O workflow de coleta única concluiu em 26/10: candidaturas, situação do registro, finanças, patrimônio e resultados foram atualizados e versionados no commit `8098ac3f62c51f49358cf1fbbffc6a1685a9fb2e`. A execução está em https://github.com/MSsanto/Elei-oes-2026/actions/runs/40327982241.

O último conjunto contém 20.065 registros de candidaturas somados entre os cinco cargos, 17.170 candidaturas com registros financeiros e 13.918 candidaturas com dados patrimoniais (77.446 bens, 4.034 vínculos históricos). Esses universos têm regras próprias e não devem ser confundidos com o total de resultados conclusivos.

## 2. Entregas preservadas

A plataforma reúne consulta por cargo e UF, perfis individuais, patrimônio declarado, finanças de campanha, fornecedores, histórico parlamentar quando confirmado, Radar, Siga o Dinheiro, educação cívica e documentação das fontes. A página `/encerramento-2026` descreve as entregas.

A nova rota `/eleitos` consulta **somente resultados oficiais do TSE**, ligados às candidaturas por `SQ_CANDIDATO`, com filtros por cargo, UF e nome, ordenação alfabética e nenhuma recomendação. Na consulta por candidatura, a interface distingue **Eleito**, **Não eleito** e **Não confirmado**; ausência de dado não equivale a derrota.

O panorama contextual agora está nas cinco consultas, com candidaturas, vagas, relação candidaturas/vaga e eleitorado apto. O eleitorado nacional consolidado de 20/07/2026 é de **158.745.463 aptos**, incluindo 918.876 no exterior, com distribuição por UF na página `/entenda`. A razão candidaturas/vaga é descritiva, não probabilidade de eleição.

As pautas editoriais sobre **quociente eleitoral**, **votos brancos versus nulos** e **distribuição de deputados federais e senadores** integram a área `/entenda` e permanecem disponíveis como material educativo neutro.

## 3. Testes e limites de validação

O build Vite, a integridade de 1.654 identificadores de eleitos, as rotas SPA, os arquivos de dados, a navegação e os elementos básicos de acessibilidade são validados pelos scripts do projeto e pelo workflow `Validar projeto`. A checagem de acessibilidade é semântica/estática e não substitui uma auditoria WCAG completa em leitores de tela e dispositivos reais.

**Publicação externa não deve ser presumida.** O GitHub pode estar atualizado enquanto o Cloudflare Pages ainda serve versão anterior. A tentativa final de publicação em 26/10/2026 ([run 40329675282](https://github.com/MSsanto/Elei-oes-2026/actions/runs/40329675282)) validou o build, mas **falhou por ausência de credenciais Cloudflare**. Uma verificação independente ([run 40330042233](https://github.com/MSsanto/Elei-oes-2026/actions/runs/40330042233)) confirmou que o domínio ainda serve um bundle anterior, sem a rota funcional de eleitas e eleitos nem o snapshot oficial; a URL do JSON devolve o HTML de fallback da SPA. **A publicação final não foi concluída.** Uma reabertura específica para deploy deverá configurar as credenciais `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`, fazer deploy e verificar a rota `/eleitos` e `/encerramento-2026` antes de afirmar que a publicação foi concluída. Se a publicação não for comprovada, o código e o snapshot permanecem arquivados sem declaração de deploy bem-sucedido.

## 4. Bloqueio de rotinas e reabertura

Os workflows históricos de coleta, importação, watchdog, atualização final, publicação e PoC foram preservados, mas não possuem gatilhos automáticos e têm o job bloqueado com `if: false`. A escrita em `contents` foi removida desses workflows. O CI de validação não mutante pode continuar em PRs e pushes.

Os scripts Windows de coleta e instalação de agendamento também recusam executar enquanto `docs/ARCHIVE_LOCK_2026.md` existir. Se houver uma tarefa já instalada no Windows, a remoção deve ser feita **na máquina** com `REMOVER_ATUALIZACAO_AUTOMATICA.bat`; o repositório não tem acesso ao Agendador de Tarefas local. Gatilhos externos na conta Cloudflare também exigem conferência no painel.

**Qualquer mudança futura exige reabertura explícita** com escopo, justificativa, fontes oficiais, revisão técnica, testes, novo commit e novo snapshot. A mera existência de uma decisão judicial posterior ou de uma nova eleição não reativa o projeto automaticamente.

## 5. Preservação e independência

O projeto é independente e não possui vínculo institucional com o TSE, partidos, campanhas ou candidaturas. Não atribui notas, rankings ou recomendações políticas. As informações refletem os dados públicos e a metodologia documentada no momento do congelamento, sem apagar histórico, correções, fontes ou evidências de coleta.
