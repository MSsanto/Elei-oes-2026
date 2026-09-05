# Patrimônio declarado — metodologia

## Escopo

A camada **Patrimônio** organiza o recurso oficial `Bens de candidatos` publicado pelo Tribunal Superior Eleitoral para as Eleições 2026 e, quando há identidade histórica confirmada, apresenta também o total nominal declarado na eleição de 2022.

A camada é descritiva. Ela não classifica candidaturas, não estima valor de mercado, não corrige valores pela inflação e não infere aumento ou redução de riqueza.

## Fontes oficiais

### Fonte primária em lote — Portal de Dados Abertos do TSE

- Portal: `https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026`
- Recurso: `https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2026.zip`
- Nome do recurso no catálogo: **Bens de candidatos**

O ZIP nacional é a fonte preferencial para processamento em lote porque permite reproduzir uma fotografia completa da base, calcular hash e gerar todos os shards a partir da mesma carga.

Campos principais usados:

- `SQ_CANDIDATO`
- `DS_TIPO_BEM_CANDIDATO`
- `DS_BEM_CANDIDATO`
- `VR_BEM_CANDIDATO`

A identificação da candidatura é feita pelo `SQ_CANDIDATO` da própria eleição.

### Fonte oficial secundária — DivulgaCandContas

- Aplicação: `https://divulgacandcontas.tse.jus.br/divulga/#/`
- API usada internamente pela aplicação: `https://divulgacandcontas.tse.jus.br/divulga/rest/v1`

O sistema oficial **DivulgaCandContas**, também mantido pelo TSE, publica o detalhe individual da candidatura e inclui a coleção de bens declarados, com tipo, descrição, valor e total quando disponíveis.

No projeto, o DivulgaCandContas tem papel de **fonte secundária de conferência e fallback por candidatura**. Ele não substitui automaticamente o ZIP nacional no processamento de toda a eleição, porque milhares de requisições individuais reduzem reprodutibilidade e aumentam custo/risco operacional. Quando usado para conferência, o `SQ_CANDIDATO`, o ano e a eleição devem corresponder exatamente ao perfil consultado.

Se Dados Abertos e DivulgaCandContas divergirem em uma mesma fotografia temporal, o projeto deve registrar a divergência e a data de coleta; não deve escolher silenciosamente um valor nem interpretar a divergência como irregularidade da candidatura.

## Transporte da coleta nacional

O CDN do TSE pode bloquear ou interromper acessos automatizados diretos. Por isso, a coleta em nuvem abre o Portal de Dados Abertos no Cloudflare Browser Run e captura o ZIP oficial pelo navegador/CDP.

No plano Free do Browser Run, novas instâncias de navegador são limitadas. O coletor patrimonial deve espaçar as três cargas necessárias e repetir somente falhas temporárias compatíveis com rate limit. Validações de assinatura ZIP, tamanho mínimo, SHA-256 e integridade permanecem obrigatórias.

A sequência atual é:

1. `bem_candidato_2026.zip`;
2. aguardar intervalo de segurança;
3. `consulta_cand_2022.zip`;
4. aguardar intervalo de segurança;
5. `bem_candidato_2022.zip`;
6. validar os três arquivos;
7. processar e publicar somente se a carga inteira for válida.

## Histórico 2022

Fontes:

- `consulta_cand_2022.zip`
- `bem_candidato_2022.zip`

A correspondência 2022 → 2026 exige, simultaneamente:

1. nome civil normalizado;
2. data de nascimento;
3. gênero;
4. assinatura exata e única entre as candidaturas processadas dos dois anos.

Se a assinatura não puder ser formada, for ambígua ou não tiver correspondência única, nenhum valor histórico é associado ao perfil.

## Privacidade das descrições

O valor e a categoria do bem permanecem preservados conforme a fonte. O texto descritivo passa por uma camada de redução antes de ser publicado no site.

Descrições podem ser substituídas ou parcialmente reduzidas quando contêm padrões compatíveis com:

- endereço e CEP;
- conta ou agência bancária;
- CPF ou CNPJ;
- telefone ou e-mail;
- placas e RENAVAM;
- matrículas e outros identificadores extensos;
- URLs.

Essa transformação não altera o arquivo oficial. Ela produz apenas a representação pública do projeto e é identificada por `descricao_reduzida: true` no registro processado.

## Arquitetura

Os dados são publicados em `data/processed/patrimonio-2026/`:

- `manifest.json`: proveniência, cobertura, transporte e método;
- `shards/<00-ff>.json`: perfis por `SQ_CANDIDATO modulo 256`.

O frontend não baixa a base nacional na consulta. Ao abrir a aba **Patrimônio**, carrega somente o shard correspondente ao identificador TSE da candidatura.

## Interpretação de ausência

A mensagem “nenhum registro localizado” significa apenas que o processador não encontrou item para aquele `SQ_CANDIDATO` na carga oficial utilizada. Ela não deve ser convertida em afirmação de patrimônio zero, omissão ou irregularidade.

Se a carga patrimonial nacional ainda não tiver sido publicada ou estiver temporariamente indisponível, a interface deve diferenciar **base não disponível** de **candidatura sem bem localizado na carga**.
