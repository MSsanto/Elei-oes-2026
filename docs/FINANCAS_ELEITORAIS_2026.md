# Finanças eleitorais 2026

A camada de finanças eleitorais usa exclusivamente registros oficiais publicados pelo TSE na Prestação de Contas Eleitorais 2026.

## Arquitetura de publicação

Os arquivos brutos nacionais não são entregues ao navegador. O pipeline processa receitas e despesas e publica perfis financeiros em 256 shards determinísticos. O shard de uma candidatura é calculado por `SQ_CANDIDATO % 256`, representado em hexadecimal com dois caracteres.

Exemplo: `/data/financas-2026/shards/7f.json`.

Cada shard contém um objeto indexado pelo identificador TSE da candidatura. Assim, o perfil baixa somente uma fração da base financeira quando é aberto.

## Dimensões exibidas

- total de receitas;
- despesas contratadas;
- despesas pagas;
- fonte dos recursos conforme classificação publicada pelo TSE;
- origem das receitas conforme classificação publicada pelo TSE;
- despesas por categoria oficial;
- principais entradas e fornecedores conforme nomes publicados;
- evolução mensal agregada.

O projeto não cria nota, ranking ou avaliação política a partir desses valores. Identificadores fiscais completos não são republicados na interface.
