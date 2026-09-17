# Coleta financeira v8 — streaming sem buffer integral

A rota `prestacaoCandidatos2026` passa a transmitir o ZIP do TSE em fluxo contínuo, sem montar o arquivo inteiro em `ArrayBuffer`/`Uint8Array` dentro do Cloudflare Worker.

Motivação: a carga financeira atual tem dezenas de megabytes e vinha provocando `Worker exceeded resource limits`. O coletor Python continua responsável pela validação final: tamanho mínimo, assinatura ZIP, SHA-256 local, abertura do arquivo e `zipfile.testzip()`.

Fluxo: GitHub Actions tenta TSE direto; em HTTP 403 usa o Worker; o Worker tenta `fetch()` no edge em streaming e, se necessário, usa Browser Run com sessão reutilizável e transmite os chunks do CDP diretamente ao cliente.
