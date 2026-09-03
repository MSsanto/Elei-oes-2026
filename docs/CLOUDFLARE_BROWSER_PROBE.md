# Teste TSE no Cloudflare Browser Run

Este teste existe para responder uma unica pergunta antes de migrar a coleta: **o TSE aceita uma sessao Chrome executada no Cloudflare Browser Run?**

O probe e isolado. Ele nao altera `data/processed`, nao publica dados eleitorais e nao substitui o coletor Windows enquanto o teste nao for aprovado.

## Arquitetura do teste

```text
GitHub Actions
    |
    v
Cloudflare Worker
    |
    v
Browser Run / Chromium
    |
    +--> Portal de Dados Abertos do TSE
    |
    +--> consulta_cand_2026.zip (somente teste de resposta HTTP)
```

Codigo: `workers/tse-browser-probe/`.

## Limites gratuitos relevantes

No Workers Free, o Browser Run oferece 10 minutos de navegador por dia. O probe fecha explicitamente o navegador ao final da requisicao e foi desenhado para terminar dentro do timeout normal do Browser Run.

Documentacao oficial:
- https://developers.cloudflare.com/browser-run/limits/
- https://developers.cloudflare.com/browser-run/puppeteer/
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/

## Configuracao unica

### 1. Criar token da Cloudflare

No painel Cloudflare, abra os tokens de API da conta e crie um token usando o template/permissao **Edit Cloudflare Workers**. Restrinja o token somente a conta usada pelo projeto.

Nao grave o token em nenhum arquivo do repositorio.

### 2. Copiar o Account ID

Copie o identificador da conta Cloudflare onde o Worker sera criado.

### 3. Criar dois secrets no GitHub

No repositorio `MSsanto/Elei-oes-2026`:

`Settings > Secrets and variables > Actions > New repository secret`

Crie:

- `CLOUDFLARE_API_TOKEN` = token criado na etapa 1.
- `CLOUDFLARE_ACCOUNT_ID` = Account ID da etapa 2.

### 4. Fazer deploy sem usar o PC como servidor

No GitHub:

`Actions > Deploy TSE Browser Probe > Run workflow`

O workflow `.github/workflows/deploy-tse-browser-probe.yml` instala as dependencias e executa `wrangler deploy` nos runners do GitHub.

Ao final, o log do Wrangler exibira a URL `workers.dev` do probe.

## Executar o teste

Abra:

```text
https://<worker>.workers.dev/probe
```

Resposta esperada quando a rota for viavel:

```json
{
  "ok": true,
  "portal": {
    "status": 200,
    "accessible": true
  },
  "resource": {
    "response": {
      "status": 200
    },
    "accepted_by_tse": true
  }
}
```

Se `resource.response.status` for `403`, o TSE tambem esta bloqueando a infraestrutura do Browser Run e nao promoveremos essa rota para producao.

## O que o probe realmente faz

1. Inicia Chromium pelo binding `BROWSER` do Cloudflare.
2. Abre `https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026`.
3. Procura no DOM o link para `consulta_cand_2026.zip`.
4. Faz o Chromium requisitar o recurso.
5. Registra o status HTTP observado.
6. Fecha o browser em `finally`, inclusive em caso de erro.

Downloads binarios podem fazer o Chromium encerrar a navegacao com `ERR_ABORTED`; por isso o probe tambem observa o evento de resposta da rede. Um `ERR_ABORTED` acompanhado de HTTP 200 e tratado como sinal de que o TSE aceitou a requisicao, nao como falha do WAF.

## Depois de um teste bem-sucedido

Somente apos `ok: true` sera criada a fase de producao:

1. captura do ZIP pelo browser remoto;
2. armazenamento temporario online;
3. processamento no GitHub Actions;
4. coleta Camara/Transferegov;
5. commit automatico;
6. deploy do site pelo Cloudflare Pages;
7. cron online;
8. desativacao do agendamento Windows.

A coleta local atual deve permanecer ativa ate a migracao online concluir uma carga completa de ponta a ponta.
