# Região eleitoral histórica por DDD

## Objetivo

O filtro de DDD do projeto é uma referência **histórica de votação**, e não uma indicação de domicílio eleitoral, residência, endereço ou área atual de atuação política.

A primeira versão usa a votação nominal para **Deputado Federal em 2022** para candidaturas de 2026 que possam ser vinculadas de forma conservadora a uma candidatura do mesmo cargo em 2022.

## Fontes oficiais

- Tribunal Superior Eleitoral (TSE): cadastro de candidaturas de 2022 e de 2026.
- Tribunal Superior Eleitoral (TSE): arquivos de Resultados 2022, com votação nominal por município.
- Agência Nacional de Telecomunicações (Anatel): relação oficial entre município e Código Nacional (DDD).

## Vínculo entre 2026 e 2022

O sistema não usa título eleitoral, CPF ou endereço para formar a correspondência histórica.

A ligação é aceita somente quando a combinação abaixo é normalizada, coincide e é **única nos dois conjuntos**:

1. nome civil completo;
2. data de nascimento;
3. gênero publicado pelo TSE.

A normalização remove diferenças de caixa, acentuação e espaços repetidos. Se houver mais de uma candidatura com a mesma assinatura em qualquer um dos anos, a correspondência é descartada automaticamente.

## Cálculo do DDD histórico principal

Para cada correspondência confirmada:

1. são lidos os votos nominais oficiais de 2022 por município;
2. cada município é associado ao respectivo Código Nacional (DDD) da Anatel;
3. os votos são somados por DDD;
4. o `DDD principal` é o DDD com a maior quantidade de votos nominais mapeados;
5. em caso de empate exato, todos os DDDs empatados são preservados como principais.

O percentual exibido para o DDD principal usa como denominador os votos que puderam ser associados a um DDD. A cobertura do cruzamento município → DDD é armazenada separadamente.

## Interpretação correta

O dado responde somente a uma pergunta factual:

> Em qual DDD se concentrou a maior parcela dos votos nominais mapeados desta candidatura na eleição de 2022?

Ele **não** permite concluir que o candidato mora, vota, mantém escritório, representa formalmente ou concentra sua atuação política naquele DDD.

Ausência de histórico significa apenas que a correspondência 2026↔2022 ou a votação regional não foi confirmada pela metodologia adotada. Não significa ausência de relação com determinada região.

## Atualização

A construção do mapa de 2022 é feita em workflow específico, porque exige leitura de arquivos municipais históricos. Depois de construído, o mapa é versionado em `data/processed/territorio/historico_ddd_2022.json` e reaplicado automaticamente a cada atualização das candidaturas de 2026.

## Neutralidade

O DDD histórico é um filtro geográfico descritivo. O projeto não cria pontuação, ranking, recomendação, avaliação de desempenho político ou inferência sobre qualidade de representação a partir da distribuição dos votos.
