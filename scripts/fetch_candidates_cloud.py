from __future__ import annotations

import hashlib
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

import fetch_candidates as base

DEFAULT_WORKER_URL = (
    "https://eleicoes-2026-tse-browser-probe.matheus-sergio.workers.dev/download"
)
ROOT = Path(__file__).resolve().parents[1]
CONTEXT_RAW_DIR = ROOT / "data" / "raw" / "contexto-eleitoral"
VAGAS_ZIP_PATH = CONTEXT_RAW_DIR / "consulta_vagas_2026.zip"
ELEITORADO_ZIP_PATH = CONTEXT_RAW_DIR / "perfil_eleitorado_2026.zip"
BROWSER_LAUNCH_GAP_SECONDS = 22


def log(message: str) -> None:
    print(message, flush=True)


def dataset_url(worker_url: str, dataset: str) -> str:
    parsed = urllib.parse.urlparse(worker_url)
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    query["dataset"] = [dataset]
    return urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(query, doseq=True)))


def download_from_worker(
    url: str,
    token: str,
    destination: Path,
    *,
    min_bytes: int = 1_000,
) -> dict[str, str | int]:
    if not token:
        raise RuntimeError(
            "TSE_WORKER_TOKEN nao configurado. Adicione o mesmo segredo no Cloudflare Worker e no GitHub Actions."
        )

    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "Eleicoes-2026-GitHub-Actions/1.0",
            "Accept": "application/zip",
        },
    )

    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(destination.suffix + ".tmp")

    log(f"Solicitando ZIP oficial do TSE via Browser Run: {url}")
    try:
        with urllib.request.urlopen(request, timeout=180) as response, partial.open("wb") as output:
            digest = hashlib.sha256()
            total = 0
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
                digest.update(chunk)
                total += len(chunk)

            status = getattr(response, "status", 200)
            content_type = response.headers.get("Content-Type", "")
            upstream_sha256 = response.headers.get("X-TSE-SHA256", "")
    except urllib.error.HTTPError as error:
        body = error.read(500).decode("utf-8", errors="replace")
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Worker retornou HTTP {error.code}: {body}") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Falha ao baixar o ZIP pelo Worker: {error}") from error

    if status != 200:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Worker retornou status inesperado: {status}")

    if total < min_bytes:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"ZIP recebido e pequeno demais: {total} bytes; minimo={min_bytes}")

    with partial.open("rb") as handle:
        signature = handle.read(4)
    if not signature.startswith(b"PK"):
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Resposta recebida nao possui assinatura ZIP: {signature!r}")

    local_sha256 = digest.hexdigest()
    if upstream_sha256 and upstream_sha256.lower() != local_sha256.lower():
        partial.unlink(missing_ok=True)
        raise RuntimeError(
            "SHA-256 divergente entre o Worker e o arquivo recebido: "
            f"worker={upstream_sha256} local={local_sha256}"
        )

    partial.replace(destination)

    with zipfile.ZipFile(destination) as archive:
        bad_file = archive.testzip()
        if bad_file:
            destination.unlink(missing_ok=True)
            raise RuntimeError(f"ZIP corrompido; primeiro arquivo invalido: {bad_file}")

    log(f"ZIP validado: {total} bytes, sha256={local_sha256}")
    return {
        "transport_url": url,
        "transport": "cloudflare_browser_run_cdp",
        "downloaded_bytes": total,
        "sha256": local_sha256,
        "content_type": content_type,
    }


def collect_context_archives(worker_url: str, token: str) -> None:
    datasets = (
        ("vagas2026", VAGAS_ZIP_PATH, 1_000),
        ("eleitorado2026", ELEITORADO_ZIP_PATH, 10_000),
    )
    for dataset, destination, min_bytes in datasets:
        log(f"Aguardando {BROWSER_LAUNCH_GAP_SECONDS}s para respeitar a cadencia do Browser Run.")
        time.sleep(BROWSER_LAUNCH_GAP_SECONDS)
        download_from_worker(
            dataset_url(worker_url, dataset),
            token,
            destination,
            min_bytes=min_bytes,
        )


def main() -> int:
    worker_url = os.environ.get("TSE_WORKER_URL", DEFAULT_WORKER_URL).strip()
    token = os.environ.get("TSE_WORKER_TOKEN", "")

    try:
        transport_metadata = download_from_worker(
            worker_url,
            token,
            base.RAW_ZIP_PATH,
            min_bytes=1_000_000,
        )
        collect_context_archives(worker_url, token)

        # O coletor existente continua responsavel por interpretar e publicar os dados.
        # Apenas substituimos o passo de download, preservando o mesmo parser usado no Windows.
        original_download = base.download
        base.download = lambda _url, destination, attempts=4: base.RAW_ZIP_PATH
        try:
            candidates, source_metadata = base.collect_from_official_zip()
        finally:
            base.download = original_download

        source_metadata.update(
            {
                "mode": "cloudflare_browser_run_zip",
                **transport_metadata,
                "context_archives": {
                    "vagas": str(VAGAS_ZIP_PATH.relative_to(ROOT)),
                    "eleitorado": str(ELEITORADO_ZIP_PATH.relative_to(ROOT)),
                },
            }
        )
        base.write_outputs(candidates, source_metadata)
        return 0
    except Exception as error:
        log(f"ERRO: coleta online nao publicada: {error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
