# Patrimônio 2026 — diagnóstico de fontes oficiais

Última revisão: **05/09/2026**

## Conclusão

A ausência de patrimônio que aparecia na interface não decorria de falta de publicação pelo Tribunal Superior Eleitoral. O TSE disponibiliza o recurso nacional **Bens de candidatos** no Portal de Dados Abertos para 2026 e também publica o detalhe individual da candidatura no **DivulgaCandContas**.

O problema observado no projeto era operacional: a primeira coleta patrimonial em nuvem abriu três instâncias de Browser Run em sequência e atingiu o limite temporário do plano usado pelo Worker. A publicação foi corretamente abortada antes de substituir qualquer base válida.

A correção foi integrada no PR #24 e a nova coleta de produção foi concluída com sucesso em 05/09/2026. A carga publicada na `main` contém:

- **13.843 candidaturas** com registros patrimoniais localizados;
- **76.806 registros de bens de 2026**;
- **256 shards** por `SQ_CANDIDATO`;
- **4.019 vínculos históricos 2022 → 2026** confirmados pela regra conservadora de identidade;
- **19.185 registros** cuja descrição pública foi reduzida pela camada de privacidade.

Manifest publicado: `data/processed/patrimonio-2026/manifest.json`.

## Fonte oficial primária

Portal de Dados Abertos do TSE:

- conjunto: `https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026`
- recurso: **Bens de candidatos**
- arquivo: `https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2026.zip`

Esta permanece a fonte preferencial para processamento nacional porque fornece uma fotografia única e reproduzível da eleição.

## Fonte oficial secundária

DivulgaCandContas:

- aplicação: `https://divulgacandcontas.tse.jus.br/divulga/#/`
- API interna da aplicação: `https://divulgacandcontas.tse.jus.br/divulga/rest/v1`

O detalhe de candidatura publicado pelo sistema contém a coleção `bens`, com descrição, tipo e valor, além do total quando publicado.

Uso recomendado no projeto:

1. conferência de registros individuais;
2. diagnóstico quando o lote nacional falhar;
3. eventual fallback por candidatura, somente se puder ser implementado com cache, controle de carga e proveniência explícita.

Não usar milhares de requisições individuais ao DivulgaCand como substituto silencioso do ZIP nacional sem uma decisão arquitetural específica.

## Regra editorial

Se as duas superfícies oficiais apresentarem valores diferentes:

- registrar fonte e horário/data de cada fotografia;
- não escolher silenciosamente um valor;
- não tratar a divergência como irregularidade da candidatura;
- priorizar a fotografia nacional validada para agregações e evolução patrimonial;
- disponibilizar o link de conferência no TSE quando aplicável.

Patrimônio declarado é apresentado de forma **descritiva**. O projeto não classifica candidaturas pelo valor declarado, não estima valor de mercado e não transforma aumento ou redução nominal entre eleições em juízo de mérito.

## Correção operacional validada

O coletor `scripts/fetch_candidate_assets_cloud.py` passou a:

- aguardar 22 segundos entre novas instâncias do Browser Run;
- repetir somente falhas temporárias compatíveis com HTTP 429/rate limit;
- manter validação de assinatura ZIP, tamanho mínimo, SHA-256 e integridade do arquivo;
- processar/publicar somente quando os três arquivos necessários estiverem válidos.

Na coleta validada de 05/09/2026:

- `bem_candidato_2026.zip`: **3.872.878 bytes**, 30 entradas, SHA-256 validado;
- `consulta_cand_2022.zip`: **4.389.914 bytes**, 30 entradas, SHA-256 validado;
- `bem_candidato_2022.zip`: **5.369.508 bytes**, 30 entradas, SHA-256 validado.

O workflow concluiu download/processamento, validação e publicação com sucesso e criou o commit de dados `6218591f4bd8862f88f86bce20cfe35017a952ba`.

## Estado atual

A primeira carga real de patrimônio está **publicada em produção**. A aba Patrimônio deve agora consumir os shards em `data/processed/patrimonio-2026/shards/` sob demanda.

Uma candidatura ausente do conjunto patrimonial não deve ser apresentada como tendo patrimônio zero. A interface deve distinguir ausência de registro localizado de valor declarado igual a zero.
