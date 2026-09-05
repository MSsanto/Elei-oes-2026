# SEO dos perfis de candidatura

## Objetivo

Permitir que URLs individuais como `/candidato/<SQ_CANDIDATO>` entreguem conteúdo e metadados úteis antes da execução do React, melhorando rastreabilidade, indexação e compartilhamento sem migrar o projeto para um framework com SSR.

## Por que não gerar um HTML por candidatura

A base atual reúne aproximadamente 20 mil candidaturas nos cinco cargos publicados. No plano gratuito do Cloudflare Pages, o limite é de 20 mil arquivos estáticos por site. Somar um `index.html` para cada candidatura aos JSONs e shards existentes eliminaria a margem operacional do projeto.

Por isso, o projeto usa uma Pages Function somente em `/candidato/[id]`.

## Fluxo

1. `scripts/prepare-public-data.mjs` copia as bases processadas para `public/data`.
2. `scripts/build_candidate_seo.mjs` reúne os campos públicos necessários para SEO.
3. Os perfis são distribuídos em até 100 shards, usando os dois últimos dígitos do `SQ_CANDIDATO`.
4. O mesmo script gera `sitemap.xml` e `robots.txt`.
5. A Pages Function `functions/candidato/[id].js` recebe a rota individual.
6. A Function busca apenas o shard correspondente, corrige a URL para a forma canônica mínima e devolve o shell React com HTML factual e metadados já preenchidos.
7. O React carrega normalmente e substitui o resumo inicial pela interface completa.

## Metadados publicados

- `title`;
- `meta description`;
- `rel=canonical`;
- Open Graph;
- Twitter Card;
- `robots=index,follow` para perfis existentes.

O HTML inicial também contém nome de urna, nome completo quando diferente, cargo, partido, UF, número, ocupação declarada e situação pública quando o campo contém texto legível. Códigos internos iniciados por `#` não são publicados como descrição humana.

## Canonicalização

A URL canônica preserva apenas os parâmetros necessários para abrir corretamente a candidatura:

- `cargo` em todos os perfis;
- `uf` para Governador, Senador e Deputado Estadual/Distrital;
- `aba` apenas quando aponta para uma aba pública reconhecida.

Filtros da lista, busca, ordenação e demais parâmetros de navegação são removidos na primeira requisição direta ao perfil.

## Erros

- identificador inválido ou inexistente: HTTP 404 + `noindex`;
- falha temporária ao consultar o índice SEO: HTTP 503 + `noindex`;
- nenhum perfil inexistente deve receber HTTP 200 apenas por causa do fallback da SPA.

## Sitemap

O build gera um único `sitemap.xml`, dentro do limite de 50 mil URLs do protocolo, contendo páginas institucionais e todos os perfis encontrados nas bases processadas.

## Validação

`npm run build` executa:

- consistência entre a contagem de candidaturas e o índice SEO;
- existência dos shards;
- presença dos perfis no sitemap;
- referência do sitemap no `robots.txt`;
- teste dos helpers de canonicalização;
- contagem de arquivos estáticos para impedir ultrapassar o limite de 20 mil arquivos do Pages Free.

A Pages Function é validada novamente pelo preview do Cloudflare em cada pull request.
