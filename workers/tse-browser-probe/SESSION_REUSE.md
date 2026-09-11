# Reuso de sessoes do Browser Run

A coleta financeira tenta os transportes nesta ordem:

1. `fetch()` a partir do edge do Cloudflare para o ZIP oficial do TSE;
2. sessao Browser Run livre, obtida por `puppeteer.sessions()` + `puppeteer.connect()`;
3. nova sessao somente quando `puppeteer.limits()` permite aquisicao.

Ao terminar, a coleta usa `browser.disconnect()` em vez de `browser.close()`. Assim a sessao fica disponivel para outra invocacao ate o timeout de inatividade do Browser Run.

A resposta de erro inclui um resumo seguro de `puppeteer.limits()` para distinguir indisponibilidade por aquisicao, concorrencia e outros erros da infraestrutura de coleta.

Revisao operacional: `dataset-router-v7-session-reuse`.
