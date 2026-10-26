# Resultado eleitoral na pesquisa — Eleições 2026

## O que é exibido

A partir do arquivo `data/processed/resultados-2026/status-por-candidato.json`, a interface apresenta o resultado **ao lado do nome** nos resultados de busca, nas sugestões e nos perfis individuais:

- **Eleito:** resultado oficial do TSE marcado como eleito, eleito por quociente partidário (QP) ou eleito por média.
- **Não eleito:** resultado oficial do TSE identificado como não eleito ou suplente; o termo significa que não houve eleição no pleito consultado, sem afirmar impossibilidade de exercício posterior do mandato.
- **Não confirmado:** ausência de registro conclusivo validado no snapshot do projeto. Nunca significa derrota presumida.

Este campo é independente da **situação de registro da candidatura**. Registro deferido não implica eleição, e indeferimento não pode ser convertido automaticamente em "Não eleito".

## Fonte e chave de identificação

TSE, portal oficial de resultados:

- https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados
- https://resultados.tse.jus.br/

O vínculo entre o JSON de candidatura e o resultado usa exclusivamente o número `SQ_CANDIDATO` da Justiça Eleitoral. Nenhum resultado é inferido por nome civil, nome de urna, partido, UF ou número de urna.

As fontes seguem a arquitetura oficial de 2026, com eleições **6257** (federal, 1º turno), **6258** (federal, 2º turno), **6259** (estaduais, 1º turno) e **6260** (estaduais, 2º turno). Cada cargo é buscado na respectiva circunscrição. Status no 2º turno prevalecem sobre resultados preliminares do 1º turno para a mesma candidatura.

## Validação e publicação

O script `scripts/collect_results_2026.py` baixa recursos oficiais de resultado, exige totalização concluída (indicadores de avanço e encerramento publicados pelo TSE) e constrói um snapshot com proveniência por arquivo e registro de falhas.

O workflow `.github/workflows/importar-resultados-2026.yml` pode ser executado manualmente e realiza a primeira consolidação quando incorporado à `main`. Cada alteração fica em commit, sem reativar as coletas contínuas suspensas em 22/10/2026.

O snapshot inicial contém registros vazios; o rótulo "Não confirmado" é exibido até a importação homologada dos resultados oficiais. A consulta não deve criar rótulos "Não eleito" para dados ausentes, falhas de rede, arquivos não totalizados ou fontes não disponibilizadas.

**Revisões eleitorais após a consolidação:** resultados podem sofrer retificações judiciais. Qualquer atualização excepcional exige execução e commit explícitos, com registro de proveniência e justificativa. A aplicação é um arquivo histórico, não uma central automática de apuração.

**Publicação da aplicação:** merge no GitHub e build do React não asseguram atualização do domínio `eleicoes-2026-ebz.pages.dev`. O deploy do Cloudflare Pages depende de integração/credenciais próprias e só deve ser dado como concluído após verificação pública.
