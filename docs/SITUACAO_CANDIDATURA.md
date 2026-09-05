# Situação oficial do registro de candidatura

## Objetivo

A plataforma publica a situação do registro de candidatura **como informação atribuída à Justiça Eleitoral**, sem criar uma classificação própria de aptidão, qualidade, risco ou mérito político.

Uma candidatura continua pesquisável mesmo quando a fonte oficial publica situações como indeferimento, recurso, cancelamento ou pedido não conhecido. A situação processual não é usada para esconder o perfil, alterar sua posição na ordenação ou criar destaque editorial.

## Fontes

A base estrutural de candidaturas continua sendo o conjunto oficial `consulta_cand_2026`, publicado pelo Tribunal Superior Eleitoral (TSE).

Como a carga aberta de 2026 pode trazer marcadores técnicos ainda não legíveis em `DS_SITUACAO_CANDIDATURA` — por exemplo, valores iniciados por `#` — o projeto consulta também o **DivulgaCandContas/TSE** para obter a descrição pública legível da situação quando ela estiver disponível.

- Dados Abertos — Candidatos 2026: <https://dadosabertos.tse.jus.br/dataset/candidatos-2026>
- DivulgaCandContas: <https://divulgacandcontas.tse.jus.br/divulga/>

## Regras editoriais

1. O texto exibido é o texto publicado pela fonte oficial. Não há tradução editorial de `deferido`, `indeferido`, `com recurso`, `cancelado`, `pedido não conhecido` ou de qualquer outra situação.
2. Marcadores técnicos sem descrição humana, como valores iniciados por `#`, não são transformados em `apto`, `inapto` ou qualquer outro rótulo por inferência.
3. Ausência de situação legível não significa deferimento, indeferimento ou irregularidade.
4. A plataforma não exclui da consulta uma candidatura por causa da situação do registro.
5. A ordenação continua neutra: Nome A–Z, Número ou Partido A–Z. Situação não gera ranking.
6. O filtro por situação apenas restringe a visualização a registros que possuem exatamente o mesmo texto oficial na carga publicada.
7. Data e origem da atualização são mantidas junto ao registro processado.
8. Situações podem mudar em razão de julgamento, recurso ou atualização da Justiça Eleitoral. A plataforma representa um retrato da última carga válida processada.

## Pipeline

`scripts/enrich_candidate_statuses.py` executa depois da geração das bases por cargo.

O fluxo é:

1. descobre a eleição ordinária de 2026 no endpoint oficial do DivulgaCandContas;
2. consulta todas as circunscrições necessárias para Presidente, Governador, Senador, Deputado Federal, Deputado Estadual e Deputado Distrital;
3. aceita somente descrições legíveis publicadas pela fonte;
4. grava um snapshot versionado por `SQ_CANDIDATO`;
5. aplica o snapshot aos arquivos processados usados pela interface;
6. preserva a última base válida se qualquer fatia da coleta atual falhar;
7. se não houver snapshot anterior nem situação legível completa, mantém a carga sem inferir um status.

A estratégia de Deputado Estadual/Distrital permanece inalterada: os dados continuam divididos por UF, cards em lotes de 60, índice de busca sob demanda e perfis carregados de forma incremental.

## Campos adicionados

Quando há enriquecimento oficial legível, o registro pode receber:

- `situacao_candidatura`
- `situacao_candidatura_detalhe`
- `situacao_candidatura_codigo`
- `situacao_candidatura_fonte`
- `situacao_candidatura_fonte_url`
- `situacao_candidatura_atualizacao`
- `situacao_candidatura_coletada_em_utc`

Esses campos são descritivos. O projeto não cria um booleano editorial de "candidato bom/ruim", "elegível/não elegível" ou equivalente.

## Confiabilidade

O snapshot só é substituído quando todas as consultas previstas para a coleta terminam sem falha. Uma execução parcial não apaga a última situação válida publicada pelo projeto.

O manifesto `data/processed/status-candidaturas/manifest.json` registra a fonte, a eleição consultada, quantidade de consultas, falhas, uso de fallback e quantidade de registros aplicados.
