# Patrimônio 2026 — diagnóstico de fontes oficiais

Última revisão: **05/09/2026**

## Conclusão

A ausência de patrimônio na interface não decorre de falta de publicação pelo Tribunal Superior Eleitoral. O TSE disponibiliza o recurso nacional **Bens de candidatos** no Portal de Dados Abertos para 2026 e também publica o detalhe individual da candidatura no **DivulgaCandContas**.

O problema observado no projeto foi operacional: a primeira coleta patrimonial em nuvem abriu três instâncias de Browser Run em sequência e atingiu o limite temporário do plano usado pelo Worker. A publicação foi corretamente abortada antes de substituir qualquer base válida.

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

O detalhe de candidatura publicado pelo sistema contém a coleção `bens`, com os campos de descrição, tipo e valor, além do total quando publicado.

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

## Correção operacional

O coletor `scripts/fetch_candidate_assets_cloud.py` passa a:

- aguardar 22 segundos entre novas instâncias do Browser Run;
- repetir somente falhas temporárias compatíveis com HTTP 429/rate limit;
- manter validação de assinatura ZIP, tamanho mínimo, SHA-256 e integridade do arquivo;
- processar/publicar somente quando os três arquivos necessários estiverem válidos.

Após o merge desta correção, a coleta patrimonial deve ser reexecutada e só será considerada concluída quando `data/processed/patrimonio-2026/manifest.json` e os shards reais estiverem publicados na `main`.
