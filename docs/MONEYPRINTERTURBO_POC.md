# PoC — MoneyPrinterTurbo no projeto Eleições 2026

## Objetivo

Validar se um runner gratuito do GitHub Actions consegue executar o MoneyPrinterTurbo e produzir um vídeo vertical MP4 sem depender, neste primeiro teste, de LLM pago, Pexels, Pixabay ou qualquer API externa com chave.

## Escopo do primeiro teste

O workflow `.github/workflows/test-moneyprinterturbo.yml`:

1. executa manualmente por `workflow_dispatch`;
2. instala FFmpeg;
3. instala `uv`;
4. baixa o MoneyPrinterTurbo `v1.3.6`;
5. instala Python 3.11 e as dependências travadas pelo projeto;
6. cria um vídeo-base local neutro em 720x1280;
7. usa um roteiro fornecido manualmente, sem geração por LLM;
8. usa Edge TTS `pt-BR-AntonioNeural`, sem API key;
9. usa o material local, sem Pexels/Pixabay;
10. renderiza um vídeo 9:16 com legendas;
11. salva o MP4, o JSON de saída do MoneyPrinterTurbo e os metadados do FFprobe como artefato do GitHub Actions por 7 dias.

## Conteúdo padrão

O roteiro padrão é propositalmente neutro e não contém informação sobre candidatos. Esta PoC testa somente a infraestrutura de mídia.

## Como executar

1. Abra a branch `test/moneyprinterturbo-poc` no GitHub.
2. Acesse **Actions**.
3. Abra **Teste MoneyPrinterTurbo (PoC)**.
4. Clique em **Run workflow** e selecione a branch `test/moneyprinterturbo-poc`.
5. Opcionalmente substitua o roteiro curto.
6. Após a execução, baixe o artefato `moneyprinterturbo-poc`.

Arquivos esperados no artefato:

- `moneyprinterturbo-poc.mp4`;
- `mpt-result.json`;
- `ffprobe.json`.

## Critérios de sucesso

A PoC é considerada aprovada se:

- o workflow encerrar com status verde;
- o artefato for publicado;
- o MP4 abrir normalmente;
- a resolução for vertical;
- a voz em português for audível;
- as legendas forem renderizadas;
- nenhuma API paga ou secret for necessário.

## Próxima etapa, se aprovado

Depois desta validação técnica, o próximo teste deve trocar o roteiro fixo por dados estruturados já existentes em `data/processed/`, mantendo geração factual, auditável e sujeita a revisão humana antes de publicação.
