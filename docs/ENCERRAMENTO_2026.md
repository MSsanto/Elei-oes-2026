# Encerramento e congelamento — Eleições 2026

**Decisão registrada em:** 22/10/2026  
**Segundo turno oficial:** 25/10/2026  
**Atualização final planejada:** 26/10/2026  
**Estado após a atualização final:** arquivo histórico congelado

## Decisão operacional

O projeto entra em modo de encerramento após o ciclo das Eleições Gerais de 2026.

A partir da publicação deste documento:

- as coletas recorrentes de candidaturas, situação de registro, finanças e patrimônio ficam suspensas;
- o watchdog deixa de executar polling periódico;
- deploy automático do Browser Worker por `push` fica desativado;
- validações de CI em pull requests podem continuar, pois não alteram dados nem produção;
- os workflows de coleta permanecem disponíveis somente por `workflow_dispatch`, como contingência manual;
- nenhuma atualização ordinária de dados deve ocorrer entre o congelamento e a carga final de 26/10/2026.

O calendário oficial do TSE estabelece o eventual segundo turno em **25 de outubro de 2026**:
https://www.tse.jus.br/comunicacao/noticias/2026/Marco/eleicoes-2026-confira-as-principais-datas-do-calendario-eleitoral

## Carga final — 26/10/2026

A atualização final deve:

1. confirmar os resultados do segundo turno em fonte oficial do TSE;
2. executar uma última coleta das bases eleitorais relevantes;
3. consolidar a situação final publicada para candidaturas e resultados;
4. implementar a aba **Eleitos**, com consulta neutra de eleitas e eleitos;
5. publicar apenas resultados oficiais, sem projeção, inferência ou ranking;
6. validar build, rotas, acessibilidade básica e integridade dos dados;
7. registrar data/hora e commit do snapshot final;
8. marcar o projeto como congelado.

A aba **Eleitos** deve contemplar os cargos das Eleições Gerais de 2026 e distinguir corretamente a circunscrição nacional e as UFs. A apresentação deve ser descritiva e simétrica, sem nota, selo, recomendação ou interpretação sobre o resultado.

## Página pública de encerramento

A rota [`/encerramento-2026`](https://eleicoes-2026-ebz.pages.dev/encerramento-2026) apresenta a conclusão do **ciclo de desenvolvimento de 2026**, suas entregas verificáveis e links para documentação e código-fonte. Essa página não deve ser usada como evidência de que a consolidação eleitoral final foi validada: o snapshot pós-segundo turno permanece uma etapa independente, documentada neste arquivo e no [`BACKLOG.md`](BACKLOG.md).

## Publicação da página de encerramento

O registro de encerramento público está implementado em `/encerramento-2026`, mas **merge no GitHub e build de CI não demonstram que o Cloudflare Pages publicou essa versão**.

A publicação final pode ser executada pelo workflow [`Publicar encerramento 2026 no Cloudflare Pages`](../.github/workflows/deploy-pages-encerramento-2026.yml), com acionamento manual (`workflow_dispatch`) e uma execução inicial após a entrada do próprio workflow na `main`. Ele:

1. utiliza Node 22 conforme `.node-version`, instala dependências e executa o build completo;
2. confirma os artefatos e a presença do texto de encerramento no bundle;
3. exige os secrets `CLOUDFLARE_API_TOKEN` (escopo Pages Write) e `CLOUDFLARE_ACCOUNT_ID`;
4. identifica o projeto Pages pelo domínio `eleicoes-2026-ebz.pages.dev` (ou por `project_name` informado na execução);
5. publica `dist` explicitamente na branch `main` por Wrangler;
6. consulta a rota pública e verifica que o bundle publicado contém o encerramento.

Caso as credenciais, o nome real do projeto ou a permissão do token estejam ausentes, o workflow **deve falhar claramente, sem alegar sucesso do deploy**. A integração Git nativa do Pages pode continuar funcionando de forma independente. Este procedimento não reativa qualquer coleta periódica.

**Critério de encerramento da publicação:** o workflow deve terminar com sucesso, incluindo a verificação HTTP pós-deploy. A consolidação final dos resultados oficiais continua uma tarefa separada.

## Política após o snapshot final

Depois da carga final:

- não haverá coleta automática;
- não haverá atualização automática de finanças, patrimônio, situação de candidatura ou atividade parlamentar;
- não haverá watchdog recorrente;
- não haverá desenvolvimento editorial ordinário;
- o site permanecerá disponível como **registro histórico do ciclo eleitoral de 2026**.

Qualquer alteração posterior exige reabertura explícita do projeto. Correções oficiais posteriores do TSE não serão incorporadas automaticamente; se houver necessidade de retificação histórica, ela deverá ser autorizada e registrada na política de correções.

## Próxima reativação

A próxima eleição deve iniciar um novo ciclo de trabalho, preferencialmente com:

- nova versão/branch de dados;
- preservação imutável do snapshot final de 2026;
- revisão de fontes e layouts conforme o novo calendário;
- migração apenas de componentes e métodos que continuarem válidos.

## Pautas editoriais preservadas para um próximo ciclo

As seguintes pautas educativas foram registradas, mas não fazem parte do encerramento de 2026:

- **Você sabe o que é quociente eleitoral?**
- **Você sabe a diferença entre votos brancos e votos nulos?**
- **Quantos são e como são distribuídos os deputados federais e os senadores?**

Se retomadas, devem usar fontes oficiais e explicar regras eleitorais de forma apartidária, sem orientar voto ou favorecer candidaturas.

## Regra de preservação

O encerramento não autoriza apagar histórico, documentação, fontes, correções ou evidências de coleta. O objetivo é transformar a aplicação de serviço eleitoral ativo em um arquivo auditável do processo de 2026.
