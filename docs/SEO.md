# SEO — perfis e diretórios editoriais de candidaturas

## Objetivo

Permitir que as páginas públicas de candidatura e os diretórios factuais por **cargo, UF e partido** entreguem conteúdo e metadados úteis antes da execução do React, melhorando rastreabilidade, descoberta orgânica, navegação interna e compartilhamento sem migrar o projeto para um framework com SSR.

A camada SEO segue as mesmas regras editoriais do produto: apresentação factual, ordenação neutra e ausência de ranking, score, popularidade ou recomendação.

## Por que não gerar um HTML por candidatura

A base atual reúne aproximadamente 20 mil candidaturas nos cinco cargos publicados. No plano gratuito do Cloudflare Pages, o limite é de 20 mil arquivos estáticos por site. Somar um `index.html` para cada candidatura aos JSONs e shards existentes eliminaria a margem operacional do projeto.

Por isso, o projeto usa **Pages Functions + JSONs gerados no build**. A resposta inicial contém HTML semântico e metadados server-side, enquanto o React continua responsável pela interface completa após a hidratação/carregamento no navegador.

## Perfis individuais

Rotas:

- `/candidato/<SQ_CANDIDATO>` com os parâmetros canônicos necessários ao contexto do cargo.

Fluxo:

1. `scripts/prepare-public-data.mjs` copia as bases processadas para `public/data`.
2. `scripts/build_candidate_seo.mjs` reúne os campos públicos necessários para SEO.
3. Os perfis são distribuídos em até 100 shards, usando os dois últimos dígitos do `SQ_CANDIDATO`.
4. O mesmo script inicia `sitemap.xml` e `robots.txt`.
5. A Pages Function `functions/candidato/[id].js` recebe a rota individual.
6. A Function busca apenas o shard correspondente, corrige a URL para a forma canônica mínima e devolve o shell React com HTML factual e metadados já preenchidos.
7. O HTML inicial também contém links crawláveis para os diretórios correspondentes por cargo, UF e partido quando aplicáveis.
8. O React carrega normalmente e substitui o resumo inicial pela interface completa.

O HTML inicial contém nome de urna, nome completo quando diferente, cargo, partido, UF, número, ocupação declarada e situação pública quando o campo contém texto legível. Códigos internos iniciados por `#` não são publicados como descrição humana.

## Diretórios editoriais indexáveis

O build cria uma malha hierárquica de navegação:

- `/candidatos/{cargo}`
- `/candidatos/{cargo}/{uf}`
- `/candidatos/{cargo}/partido/{sigla-ou-slug}`
- `/candidatos/{cargo}/{uf}/partido/{sigla-ou-slug}`

A estrutura evita transformar combinações arbitrárias de filtros da consulta em URLs indexáveis. Somente os recortes editoriais explicitamente gerados entram no sitemap.

### Geração

`scripts/build_editorial_seo.mjs` lê o índice SEO de candidaturas já validado e gera JSONs em:

`public/data/seo/editorial/pages/`

Cada página registra:

- rota e canonical;
- `title`, heading e description;
- cargo, UF e partido do recorte;
- quantidade de candidaturas;
- lista de candidaturas em **Nome A–Z**;
- links para perfis individuais;
- links para subdivisões por UF e partido;
- fonte oficial e metodologia;
- indicação explícita de que não existe ranking ou recomendação.

A Pages Function `functions/candidatos/[[path]].js` usa esses JSONs para devolver HTML inicial indexável, canonical, Open Graph, Twitter Card e links crawláveis antes da execução do React. O componente `src/editorialDirectory.jsx` assume a experiência interativa no navegador.

### Proteção da arquitetura leve

Páginas nacionais de cargos que possuem subdivisão por UF não carregam milhares de candidaturas em um único JSON. Elas exibem uma **amostra inicial de até 60 nomes em ordem alfabética**, além dos links para UF e partido.

Os recortes por UF e/ou partido publicam o subconjunto correspondente e podem usar carregamento incremental na interface. Essa regra preserva especialmente a estratégia de Deputado Estadual/Distrital, evitando reconstruir uma base nacional pesada no cliente.

## Metadados publicados

Perfis e diretórios existentes recebem:

- `title`;
- `meta description`;
- `rel=canonical`;
- Open Graph;
- Twitter Card;
- `robots=index,follow`.

Rotas inválidas recebem 404 + `noindex`. Falhas temporárias da camada de dados recebem 503 + `noindex`.

## Canonicalização

### Perfil

A URL canônica preserva somente:

- `cargo` em todos os perfis;
- `uf` para Governador, Senador e Deputado Estadual/Distrital;
- `aba` apenas quando aponta para uma aba pública reconhecida.

Filtros da lista, busca, ordenação e demais parâmetros de navegação são removidos na primeira requisição direta ao perfil.

### Diretório editorial

As páginas editoriais usam apenas os segmentos hierárquicos suportados. Query strings em `/candidatos/...` são removidas por redirecionamento 308 para a rota canônica. Combinações que não correspondem a uma página gerada retornam 404 + `noindex`.

## Links internos

A malha é bidirecional:

- diretório → perfis individuais;
- diretório → subdivisões por UF e partido;
- perfil individual → cargo, UF e partido correspondentes.

Assim, os perfis não dependem apenas do sitemap para serem descobertos e passam a integrar um grafo interno de navegação factual.

## Sitemap

O build gera um único `sitemap.xml`, dentro do limite de 50 mil URLs do protocolo, contendo:

- páginas institucionais/editoriais principais;
- todos os perfis encontrados nas bases processadas;
- todos os diretórios editoriais gerados por cargo, UF e partido.

## Validação

`npm run build` executa, entre outras verificações:

- consistência entre a contagem de candidaturas e o índice SEO;
- existência dos shards de perfil;
- presença dos perfis no sitemap;
- referência do sitemap no `robots.txt`;
- geração e unicidade das rotas editoriais;
- ordenação padrão **Nome A–Z**;
- ausência de flags de ranking/recomendação;
- amostra nacional limitada a 60 quando houver subdivisão por UF;
- presença de recortes completos por UF/partido;
- links internos agregador → perfil;
- helpers de canonicalização das duas Pages Functions;
- contagem total de arquivos estáticos para impedir ultrapassar o limite de 20 mil arquivos do Pages Free.

No build que introduziu a malha editorial, a base possuía **19.991 perfis**, foram geradas **1.828 páginas agregadoras** e o build resultou em **4.228 arquivos estáticos**, mantendo ampla margem para o limite operacional do Cloudflare Pages.

As Pages Functions são validadas novamente pelo preview do Cloudflare em cada pull request.
