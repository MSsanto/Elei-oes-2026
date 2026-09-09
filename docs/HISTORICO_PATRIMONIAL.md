# Histórico de declarações patrimoniais

## Objetivo

A seção de patrimônio do perfil de candidatura passa a apresentar as declarações oficiais localizadas em eleições diferentes, em ordem cronológica, preservando uma leitura factual e rastreável.

A interface não produz ranking, score, conclusão política ou inferência sobre origem de recursos, renda, valorização de mercado ou eventual irregularidade.

## Fonte

Os registros utilizam os arquivos **Bens de candidatos** do Portal de Dados Abertos do Tribunal Superior Eleitoral (TSE):

- 2026: https://dadosabertos.tse.jus.br/dataset/candidatos-2026
- 2022: https://dadosabertos.tse.jus.br/dataset/candidatos-2022

O Portal de Dados Abertos do TSE mantém conjuntos históricos de candidaturas e declarações de bens por eleição.

## Vínculo entre eleições

O histórico 2022 → 2026 só é publicado quando a identidade atende ao critério conservador já adotado pelo projeto:

1. nome civil normalizado;
2. data de nascimento;
3. gênero;
4. assinatura exata e única nas duas eleições.

A simples semelhança de nome não é utilizada para vincular registros.

## Como a interface apresenta os dados

Quando existe vínculo histórico confirmado, são exibidos separadamente:

- **2022 — Declaração histórica localizada — Eleições 2022**;
- **2026 — Candidatura atual — Eleições 2026**.

Cada linha mostra o valor nominal declarado na respectiva eleição.

Não são calculados na interface:

- percentual de aumento ou redução;
- diferença patrimonial agregada;
- ranking de crescimento;
- score patrimonial;
- correção monetária automática;
- estimativa de valor atual de mercado.

## Mandato e candidatura

Uma declaração patrimonial em determinada eleição comprova a existência daquele registro de candidatura e de sua declaração de bens no conjunto oficial consultado. Ela **não é usada isoladamente para afirmar que a pessoa foi eleita ou exerceu mandato**.

Quando a plataforma possuir histórico parlamentar confirmado por fonte oficial, essa informação permanece apresentada em módulo próprio de atuação parlamentar, separada da declaração patrimonial.

Essa separação evita transformar correlação temporal em afirmação sobre mandato sem confirmação documental específica.

## Valores nominais

Os valores são apresentados exatamente como consolidados a partir dos registros oficiais daquela eleição, em reais nominais. Não há correção por inflação ou reavaliação de bens.

Por isso, valores de eleições distintas devem ser lidos como fotografias documentais de declarações feitas em momentos diferentes, e não como avaliação econômica atual dos ativos.

## Privacidade

Descrições de bens passam pelo redutor de exposição já adotado pelo projeto. Padrões de endereço, dados bancários, documentos, telefone, CEP, placas, matrículas e outros identificadores extensos podem ser ocultados na interface, preservando categoria e valor do bem.

## Arquivos relacionados

- `src/candidateAssets.jsx`
- `src/candidateAssets.css`
- `scripts/build_candidate_assets_2026.py`
- `data/processed/patrimonio-2026/`
