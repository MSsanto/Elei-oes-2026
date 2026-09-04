# Arquitetura multi-cargo — Eleições 2026

Este documento define a arquitetura prevista para expansão do projeto para outros cargos nas Eleições 2026, preservando neutralidade político-partidária, rastreabilidade das fontes oficiais e desempenho do frontend.

## 1. Navegação por cargo

A interface deve evoluir para uma navegação principal por abas:

```text
Presidente | Governador | Senador | Deputado Federal | Deputado Estadual/Distrital
```

A aba selecionada deve ser persistida na URL.

Exemplo:

```text
/?cargo=deputado-estadual&uf=SP&partido=PT
```

Os parâmetros devem representar apenas filtros objetivos da base e nunca ranking, relevância política ou recomendação.

## 2. Filtros dinâmicos por cargo

### Presidente

Circunscrição nacional única.

- Ocultar filtro de Região.
- Ocultar filtro de UF.
- Manter busca por nome/número, partido e ocupação.
- Não exibir controles territoriais sem função eleitoral real.

### Governador

Circunscrição estadual.

- UF obrigatória antes da carga da lista.
- Não adotar SP ou qualquer outra UF como padrão automático.
- A tela inicial da aba deve solicitar uma UF de forma neutra.
- Depois da UF: busca, partido, ocupação e ordenação.

### Senador

Circunscrição estadual.

- Mesma regra territorial de Governador: UF obrigatória antes da carga dos registros.
- Suplentes devem ser representados como parte da candidatura/chapa quando a fonte oficial assim estruturar os dados.

### Deputado Federal

Circunscrição estadual, com grande volume de candidaturas.

- Região como filtro de conveniência de interface, derivado apenas da UF.
- Região não representa uma nova circunscrição eleitoral.
- Seleção de Região reduz a lista de UFs disponíveis.
- UF deve ficar visualmente próxima do filtro de Partido.
- Permitir busca, ocupação, partido e ordenação.

### Deputado Estadual/Distrital

Maior volume previsto do sistema.

- Nunca carregar o dataset nacional completo na inicialização.
- Região opcional como agrupador de UFs.
- UF necessária antes da carga das candidaturas.
- Distrito Federal deve ser tratado de acordo com o cargo oficial publicado pelo TSE.
- Busca, ocupação, partido e ordenação devem operar apenas sobre o conjunto carregado.

## 3. Região como conveniência de interface

As regiões devem ser derivadas da UF usando a divisão regional oficial do Brasil e usadas somente para reduzir opções na interface:

```text
Norte
Nordeste
Centro-Oeste
Sudeste
Sul
```

O filtro Região nunca deve ser descrito como circunscrição eleitoral quando o cargo é disputado por UF.

Fluxo sugerido:

```text
Região -> UF -> Partido -> Ocupação -> Busca
```

## 4. Estratégia de dados

### Princípio

O navegador deve baixar apenas os registros necessários à consulta atual.

Não usar um único JSON nacional contendo todos os cargos e todas as candidaturas.

### Estrutura sugerida

```text
public/data/candidatos/
  manifest.json
  presidente/
    brasil.json
  governador/
    AC.json
    AL.json
    ...
  senador/
    AC.json
    AL.json
    ...
  deputado-federal/
    AC/
      manifest.json
      pagina-001.json
      pagina-002.json
    SP/
      manifest.json
      pagina-001.json
      ...
  deputado-estadual/
    AC/
      manifest.json
      pagina-001.json
      ...
    SP/
      manifest.json
      pagina-001.json
      pagina-002.json
      ...
```

Arquivos podem ser gerados pelo ETL e servidos estaticamente pelo Cloudflare Pages. Uma API dinâmica não é obrigatória para a primeira versão multi-cargo.

## 5. Paginação e rolagem infinita

A rolagem infinita deve evoluir de paginação apenas visual para paginação real de dados.

Fluxo:

1. usuário escolhe cargo e, quando aplicável, UF;
2. frontend baixa `manifest.json` do conjunto;
3. carrega apenas `pagina-001.json`;
4. ao se aproximar do final da lista, carrega a página seguinte;
5. filtros que puderem ser resolvidos pelo manifesto devem evitar baixar páginas desnecessárias;
6. filtros textuais podem exigir índice específico ou busca local apenas sobre o conjunto já carregado até uma evolução posterior.

A lista não deve manter dezenas de milhares de cards simultaneamente no DOM. Caso o volume por UF ainda seja elevado, adotar virtualização/windowing da lista.

## 6. Manifestos

Cada conjunto pode possuir um manifesto pequeno com metadados suficientes para montar os filtros antes de carregar as candidaturas:

```json
{
  "cargo": "deputado-estadual",
  "uf": "SP",
  "total": 0,
  "paginas": 0,
  "tamanho_pagina": 100,
  "partidos": [],
  "ocupacoes": [],
  "generated_at_utc": ""
}
```

Isso permite preencher os controles da interface sem baixar o dataset inteiro.

## 7. Persistência na URL

Filtros relevantes devem ser refletidos em query parameters.

Parâmetros previstos:

```text
cargo
regiao
uf
partido
ocupacao
q
ordenacao
candidato
```

Exemplos:

```text
/?cargo=presidente&partido=ABC
/?cargo=governador&uf=RJ
/?cargo=deputado-federal&regiao=Sudeste&uf=SP&ocupacao=ADVOGADO
/?cargo=deputado-estadual&uf=MG&partido=XYZ&q=maria
```

Ao abrir uma URL compartilhada, o frontend deve reconstruir a aba, os filtros e, quando houver `candidato`, abrir o perfil correspondente.

## 8. Cabeçalho e hierarquia visual

Estrutura conceitual:

```text
[ Eleições 2026 | Transparência ]                         [ GitHub ]
-------------------------------------------------------------------
[ Presidente ] [ Governador ] [ Senador ] [ Dep. Federal ] [ Dep. Estadual ]
-------------------------------------------------------------------
[ Buscar nome/número... ] [ Região ] [ UF ] [ Partido ] [ Ocupação ] [ Ordenar ]
```

Controles sem função para a aba atual devem ser removidos da interface, não apenas desabilitados, sempre que isso melhorar clareza e acessibilidade.

## 9. Estado inicial por aba

- Presidente: pode carregar imediatamente porque o volume é pequeno.
- Governador: aguardar escolha de UF.
- Senador: aguardar escolha de UF.
- Deputado Federal: pode manter comportamento atual durante a migração, mas a arquitetura final deve carregar por UF/páginas.
- Deputado Estadual/Distrital: exigir UF antes de qualquer carga pesada.

Não selecionar automaticamente uma UF com base em IP, localização do navegador ou preferência presumida. Uma preferência explícita do usuário poderá ser lembrada localmente no futuro, mas a URL deve permanecer a fonte reproduzível do estado compartilhável.

## 10. Neutralidade e semântica

- Região é conveniência de navegação, não indicador de relevância política.
- A ordem padrão deve ser objetiva e documentada, preferencialmente alfabética.
- Nenhum cargo, partido, UF ou candidatura recebe prioridade visual por inferência do sistema.
- Filtros e URLs devem reproduzir exatamente escolhas explícitas do usuário.
- Dados ausentes devem ser tratados como não localizados/não publicados na fonte consultada, sem inferir ausência do fato.
