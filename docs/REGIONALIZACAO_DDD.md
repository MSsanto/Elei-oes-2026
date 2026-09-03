# Regionalização por DDD

## Objetivo

Permitir um refinamento geográfico simples na busca de candidaturas sem atribuir ao candidato uma região política que a fonte oficial não comprove.

## Versão inicial: DDD de naturalidade

A primeira implementação usa dois campos publicados pelo TSE no arquivo `consulta_cand_2026`:

- `SG_UF_NASCIMENTO`;
- `NM_MUNICIPIO_NASCIMENTO`.

O município de nascimento é cruzado com o Plano Geral de Códigos Nacionais (PGCN) publicado pela Agência Nacional de Telecomunicações (Anatel), produzindo o campo derivado `ddd_nascimento`.

### Interpretação correta

`ddd_nascimento` significa apenas:

> Código Nacional (DDD) associado pela Anatel ao município de nascimento informado ao TSE.

Ele **não significa**:

- domicílio eleitoral;
- município onde o candidato mora;
- base eleitoral;
- região de atuação política;
- região onde o candidato recebeu mais votos.

Por essa razão, a interface exibe o filtro como **DDD de nascimento** e mostra uma nota metodológica próxima aos filtros.

## Fontes

- Tribunal Superior Eleitoral (TSE) — conjunto Candidatos 2026 / `consulta_cand_2026`.
- Agência Nacional de Telecomunicações (Anatel) — Plano Geral de Códigos Nacionais (PGCN), que relaciona município e Código Nacional (DDD).

O pipeline registra no `data/processed/metadata.json` qual URL da Anatel foi efetivamente utilizada para montar a tabela de DDDs.

## Próxima camada: base eleitoral histórica

Uma camada futura poderá usar resultados eleitorais oficiais por município para responder a uma pergunta diferente e mais útil:

> Em quais municípios/DDD este político concentrou votos em eleições anteriores?

Esse indicador deverá ser exibido separadamente da naturalidade e sempre acompanhado do ano eleitoral, quantidade de votos e fonte TSE. Ele não substituirá nem alterará o campo de naturalidade.
