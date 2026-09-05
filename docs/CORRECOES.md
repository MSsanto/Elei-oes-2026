# Política de correções e retificações

## Princípio

Eleições 2026 — Transparência Eleitoral organiza dados públicos de fontes oficiais. Quando a plataforma publicar informação incorreta por falha de coleta, processamento, associação entre bases, interface ou texto editorial, a correção deve ser **rastreável e versionada**.

Uma alteração feita pela própria fonte oficial não é, por si só, erro do projeto. Nesses casos, a plataforma atualiza a carga e identifica a nova data/fonte sempre que a camada permitir.

## O que deve gerar registro de correção

Registrar uma correção quando houver, por exemplo:

- associação incorreta entre pessoas ou bases;
- valor, situação, partido, cargo ou outro campo exibido de forma diferente da fonte usada naquela carga;
- erro de transformação ou agregação;
- texto institucional que descreva de maneira incorreta a metodologia ou a origem de um dado;
- falha de interface que atribua informação de um registro a outro.

Não registrar como "correção" uma simples atualização ordinária da fonte oficial, desde que a plataforma anterior reproduzisse corretamente a carga então disponível.

## Campos mínimos

Cada correção relevante deve registrar:

| Campo | Conteúdo |
| --- | --- |
| Data | data da publicação da correção |
| Conteúdo afetado | página, campo, conjunto de dados ou componente |
| Motivo | descrição objetiva do erro do projeto |
| Fonte de conferência | órgão/conjunto oficial usado para validar a correção |
| Versão | commit, PR ou release em que a correção foi aplicada |
| Efeito | o que mudou na informação pública |

## Regras editoriais

- A correção deve descrever **o erro do projeto**, sem atribuir culpa à candidatura, partido ou órgão-fonte.
- Uma ausência ou atraso de atualização da fonte não deve ser descrito como irregularidade de uma candidatura.
- Correções devem usar os mesmos critérios independentemente da pessoa, partido, cargo ou posição política envolvida.
- O histórico não deve ser apagado silenciosamente. Quando uma correção registrada precisar ser corrigida, uma nova entrada deve explicar a mudança.
- Alterações exclusivamente visuais, sem efeito no conteúdo ou interpretação, podem permanecer apenas no histórico Git.

## Registro de correções

A tabela abaixo é o registro versionado desta política.

| Data | Conteúdo afetado | Motivo | Fonte | Versão | Efeito |
| --- | --- | --- | --- | --- | --- |

Nenhuma entrada deve ser criada para preencher a tabela artificialmente. Ela passa a registrar ocorrências quando uma correção editorial ou de dados efetivamente for necessária.

## Como conferir

O histórico Git do repositório registra todas as mudanças técnicas. Correções relevantes devem apontar para o commit/PR correspondente e, quando aplicável, para a fonte oficial usada na conferência.

- Repositório: <https://github.com/MSsanto/Elei-oes-2026>
- Metodologia pública: <https://eleicoes-2026-ebz.pages.dev/metodologia>
- Fontes públicas: <https://eleicoes-2026-ebz.pages.dev/fontes>
