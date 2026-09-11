## Correcao do HTTP 429 no Browser Run

A revisao v6 eliminou o erro `Fetch.getResponseBody: Target closed`, mas a homologacao em producao revelou `Unable to create new browser: 429 Rate limit exceeded`.

A v7 evita criar Chromium desnecessariamente: tenta `fetch()` no edge do Cloudflare, reaproveita sessoes livres, consulta limites antes de adquirir uma nova sessao e desconecta sem destruir o browser. O ultimo snapshot valido continua preservado se todos os transportes falharem.
