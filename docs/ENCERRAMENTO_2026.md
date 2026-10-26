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
