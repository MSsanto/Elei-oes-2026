# Publicação do arquivo eleitoral 2026 no Cloudflare Pages

## Bloqueio identificado

A tentativa de publicação de 26/10/2026 foi recusada pelo Cloudflare Pages porque o arquivo público `data/editorial/fornecedores/index.json` chegava a **121 MiB**, acima do limite de **25 MiB por arquivo**. Outro arquivo de origem, `data/financas-2026/fornecedores/index.json`, tinha cerca de **88 MB**.

Esses índices são úteis para gerar o catálogo, mas arquivos desse porte não devem ser servidos integralmente pelo navegador nem enviados para o Pages.

## Adaptação do pacote público

- Os arquivos integrais permanecem no repositório sob `data/processed`. Não há exclusão ou reprocessamento das fontes históricas.
- `scripts/prepare-public-data.mjs` remove **apenas da cópia** `public/data` o índice financeiro usado internamente pelo gerador.
- `scripts/build_editorial_phase2.mjs` gera `data/editorial/fornecedores/index.json` em formato leve (`schema_version: 2`), contendo a amostra inicial, o total de fornecedores e o mapa de fragmentos.
- Os registros do diretório são divididos em arquivos de **até 2.000 fornecedores**, em `data/editorial/fornecedores/busca/<prefixo>-<pagina>.json`.
- `src/editorialPhase2.jsx` carrega o fragmento correspondente quando o visitante informa pelo menos duas letras iniciais do nome; a listagem inicial continua mostrando os primeiros 80 registros.
- Os shards por identificador em `data/editorial/fornecedores/shards` seguem intactos para a rota individual de fornecedores.
- `scripts/check_navigation_build.mjs` impede a conclusão do build caso **qualquer arquivo público** ultrapasse 25 MiB e verifica a presença do índice e da busca fragmentada.
- `scripts/smoke_preview.mjs` verifica a consulta de pelo menos um fragmento e uma página individual.

**Mudança de comportamento documentada:** a busca no diretório começa pelas primeiras duas letras do nome do fornecedor. Não tenta carregar e filtrar em memória os mais de 600 mil fornecedores. A navegação por URL de fornecedor continua independente da busca.

## Governança

Trata-se somente de uma adequação técnica para disponibilizar o snapshot já congelado. O conteúdo de apuração eleitoral, o importador de resultados, as coletas programadas e os dados integrais armazenados em `data/processed` permanecem inalterados.

A validação completa do build e a verificação pública das rotas `/encerramento-2026` e `/eleitos` são condições necessárias para declarar a publicação concluída.

## Homologação de produção — 26/10/2026

**Resultado: PUBLICADO E VALIDADO.**

- Projeto Cloudflare Pages existente: `eleicoes-2026`.
- Domínio de produção confirmado pela API Cloudflare: `eleicoes-2026-ebz.pages.dev`.
- Workflow excepcional: [execução 40359713307](https://github.com/MSsanto/Elei-oes-2026/actions/runs/40359713307), **success**, incluindo build, checagem de credenciais, seleção do projeto, upload e teste HTTP público.
- Upload Cloudflare: **5.338 arquivos**, conclusão informada pelo Wrangler.
- Deploy identificado pelo Cloudflare: `https://68638f5e.eleicoes-2026-ebz.pages.dev`.
- As rotas `/encerramento-2026` e `/eleitos` retornaram aplicação válida. A conferência HTTP também validou que o bundle principal contém os títulos dessas páginas.
- Os scripts de coleta periódica, watchdog e outros workflows de publicação congelados não foram reativados.
- Após a homologação, `.github/workflows/publicar-arquivo-2026-uma-vez.yml` voltou ao estado manual com `if: false`, impedindo nova publicação acidental.

O ciclo eleitoral de 2026 permanece arquivado; esta intervenção tratou apenas a **entrega pública** do snapshot já consolidado e a compatibilidade dos arquivos de fornecedores com o limite do Cloudflare Pages.
