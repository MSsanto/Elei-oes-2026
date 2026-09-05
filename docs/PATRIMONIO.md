# Patrimônio declarado — metodologia

## Escopo

A camada **Patrimônio** organiza o recurso oficial `Bens de candidatos` publicado pelo Tribunal Superior Eleitoral para as Eleições 2026 e, quando há identidade histórica confirmada, apresenta também o total nominal declarado na eleição de 2022.

A camada é descritiva. Ela não classifica candidaturas, não estima valor de mercado, não corrige valores pela inflação e não infere aumento ou redução de riqueza.

## Fonte atual

- Portal: `https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026`
- Recurso: `bem_candidato_2026.zip`

Campos principais usados:

- `SQ_CANDIDATO`
- `DS_TIPO_BEM_CANDIDATO`
- `DS_BEM_CANDIDATO`
- `VR_BEM_CANDIDATO`

A identificação da candidatura é feita pelo `SQ_CANDIDATO` da própria eleição.

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

- `manifest.json`: proveniência, cobertura e método;
- `shards/<00-ff>.json`: perfis por `SQ_CANDIDATO modulo 256`.

O frontend não baixa a base nacional na consulta. Ao abrir a aba **Patrimônio**, carrega somente o shard correspondente ao identificador TSE da candidatura.

## Interpretação de ausência

A mensagem “nenhum registro localizado” significa apenas que o processador não encontrou item para aquele `SQ_CANDIDATO` na carga oficial utilizada. Ela não deve ser convertida em afirmação de patrimônio zero, omissão ou irregularidade.
