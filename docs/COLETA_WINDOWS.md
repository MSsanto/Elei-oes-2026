# Coleta nacional pelo Windows

O TSE bloqueou as requisições vindas dos runners públicos do GitHub nos EUA. Por isso, a carga nacional é executada a partir de um computador no Brasil e publicada no GitHub; o Cloudflare Pages detecta o commit e atualiza o site automaticamente.

## Pré-requisitos

- Windows 10 ou 11.
- Git for Windows instalado e autenticado no GitHub.
- Python 3 instalado. Não há dependências Python externas: o coletor usa apenas a biblioteca padrão.
- Um clone local deste repositório.

## Primeira instalação

Abra o Prompt de Comando ou PowerShell e execute:

```powershell
git clone https://github.com/MSsanto/Elei-oes-2026.git
cd Elei-oes-2026
```

Se o repositório já estiver clonado, apenas execute `git pull` antes da primeira coleta.

## Coleta manual — um clique

Na pasta do projeto, execute:

`COLETAR_E_PUBLICAR.bat`

O processo faz automaticamente:

1. verifica Git e Python;
2. garante que não existem alterações locais não commitadas;
3. executa `git pull --rebase origin main`;
4. tenta baixar o ZIP oficial `consulta_cand_2026.zip` do Portal de Dados Abertos do TSE;
5. se o ZIP falhar, tenta o REST oficial do DivulgaCandContas para as 27 UFs;
6. filtra apenas `Deputado Federal`;
7. normaliza e remove duplicidades pelo identificador oficial do candidato;
8. gera `data/processed/deputados_federais.json`;
9. gera também `data/processed/ufs/UF.json` para cada UF;
10. grava `data/processed/metadata.json` com data, fonte e quantidade de registros;
11. faz commit e push apenas se os dados tiverem mudado;
12. o Cloudflare Pages publica a nova carga automaticamente.

Se o push exigir autenticação, conclua o login solicitado pelo Git/GitHub na primeira execução.

## Atualização automática

Depois de validar uma coleta manual, execute:

`INSTALAR_ATUALIZACAO_AUTOMATICA.bat`

Será criada no Agendador de Tarefas do Windows a tarefa:

`Eleicoes2026-Coletor-TSE`

Horários locais configurados:

- 00:25
- 06:25
- 12:25
- 18:25

A tarefa usa `StartWhenAvailable`: quando possível, uma execução perdida poderá ser iniciada quando o Windows voltar a ficar disponível. O computador precisa estar ligado e o usuário precisa estar em uma sessão utilizável para que o Git possa acessar as credenciais armazenadas.

## Remover a automação

Execute:

`REMOVER_ATUALIZACAO_AUTOMATICA.bat`

Isso remove apenas a tarefa agendada. O projeto, os dados e o repositório permanecem intactos.

## Logs

As execuções locais gravam logs em:

`.collector/logs/`

Essa pasta é ignorada pelo Git.

## Segurança dos dados

O coletor segue uma regra de publicação atômica: uma carga que falha não apaga nem publica por cima da última base válida. Quando a fonte oficial não responde, o script termina com erro e preserva os arquivos processados existentes.

## Arquivos publicados

- `data/processed/deputados_federais.json` — carga nacional compacta.
- `data/processed/metadata.json` — metadados da carga.
- `data/processed/ufs/AC.json` até `TO.json` — cargas por UF.

O frontend usa primeiro a carga estática publicada. A função Cloudflare permanece apenas como apoio/fallback durante o desenvolvimento.
