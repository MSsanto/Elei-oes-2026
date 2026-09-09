from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import build_campaign_finance_2026 as builder

DEFAULT_WORKER_URL = (
    "https://eleicoes-2026-tse-browser-probe.matheus-sergio.workers.dev/"
    "download?dataset=prestacaoCandidatos2026"
)
ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / ".collector" / "financas-2026"
ZIP_PATH = CACHE_DIR / "prestacao_de_contas_eleitorais_candidatos_2026.zip"
STATUS_PATH = ROOT / "data" / "status" / "finance-collection.json"
DEFAULT_MAX_ATTEMPTS = 3
DEFAULT_RETRY_SECONDS = 15


def log(message: str) -> None:
    print(message, flush=True)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def classify_origin(error: Exception) -> str:
    message = str(error).lower()
    if "token" in message or "configurado" in message:
        return "platform_configuration"
    if "worker" in message or "http 5" in message or "baixar" in message:
        return "collection_infrastructure"
    return "platform_processing"


def write_status(
    status: str,
    *,
    attempts: int,
    worker_url: str,
    error: Exception | None = None,
    transport: dict | None = None,
    manifest: dict | None = None,
) -> None:
    payload = {
        "schema_version": 1,
        "generated_at": utc_now(),
        "component": "financas_2026",
        "status": status,
        "source": "TSE - Prestacao de Contas Eleitorais 2026",
        "collector": "cloudflare_browser_worker",
        "attempts": attempts,
        "worker_url": worker_url,
        "origin": "none" if error is None else classify_origin(error),
        "message": (
            "Coleta financeira concluida e validada pelo coletor."
            if error is None
            else "A ultima carga financeira valida foi preservada; uma nova coleta nao foi publicada."
        ),
        "last_error": None if error is None else str(error)[:2000],
    }
    if transport:
        payload["transport"] = transport
    if manifest:
        payload["snapshot"] = {
            "generated_at": manifest.get("generated_at"),
            "candidates": manifest.get("candidates"),
            "shard_count": manifest.get("shard_count"),
        }

    STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATUS_PATH.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(STATUS_PATH)


def download(url: str, token: str, destination: Path) -> dict:
    if not token:
        raise RuntimeError("TSE_WORKER_TOKEN nao configurado no GitHub Actions.")

    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "Eleicoes-2026-Financas/1.1",
            "Accept": "application/zip",
        },
    )

    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(destination.suffix + ".tmp")
    partial.unlink(missing_ok=True)
    digest = hashlib.sha256()
    total = 0

    log(f"Baixando Prestacao de Contas Eleitorais 2026 via Browser Worker: {url}")
    try:
        with urllib.request.urlopen(request, timeout=360) as response, partial.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
                digest.update(chunk)
                total += len(chunk)
            status = getattr(response, "status", 200)
            content_type = response.headers.get("Content-Type", "")
            upstream_sha256 = response.headers.get("X-TSE-SHA256", "")
            source_url = response.headers.get("X-TSE-Source", "")
            worker_revision = response.headers.get("X-Production-Revision", "")
    except urllib.error.HTTPError as error:
        body = error.read(1000).decode("utf-8", errors="replace")
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Worker retornou HTTP {error.code}: {body}") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Falha ao baixar a prestacao via Worker: {error}") from error

    if status != 200:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Worker retornou status inesperado: {status}")
    if total < 10_000:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"ZIP recebido e pequeno demais: {total} bytes")

    with partial.open("rb") as handle:
        if not handle.read(4).startswith(b"PK"):
            partial.unlink(missing_ok=True)
            raise RuntimeError("Resposta recebida nao possui assinatura ZIP.")

    local_sha256 = digest.hexdigest()
    if upstream_sha256 and upstream_sha256.lower() != local_sha256.lower():
        partial.unlink(missing_ok=True)
        raise RuntimeError(
            f"SHA-256 divergente: worker={upstream_sha256} local={local_sha256}"
        )

    partial.replace(destination)
    with zipfile.ZipFile(destination) as archive:
        bad_file = archive.testzip()
        if bad_file:
            destination.unlink(missing_ok=True)
            raise RuntimeError(f"ZIP corrompido; primeiro arquivo invalido: {bad_file}")
        names = archive.namelist()

    log(f"ZIP validado: {total} bytes, {len(names)} entradas, sha256={local_sha256}")
    return {
        "transport": "cloudflare_browser_run_cdp",
        "transport_url": url,
        "source_url": source_url,
        "downloaded_bytes": total,
        "sha256": local_sha256,
        "content_type": content_type,
        "worker_revision": worker_revision,
        "archive_entries": len(names),
    }


def download_with_retry(url: str, token: str, destination: Path) -> tuple[dict, int]:
    max_attempts = max(1, int(os.environ.get("TSE_FINANCE_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS)))
    base_delay = max(1, int(os.environ.get("TSE_FINANCE_RETRY_SECONDS", DEFAULT_RETRY_SECONDS)))
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            log(f"Tentativa {attempt}/{max_attempts} da coleta financeira.")
            return download(url, token, destination), attempt
        except Exception as error:
            last_error = error
            log(f"Tentativa {attempt}/{max_attempts} falhou: {error}")
            if attempt < max_attempts:
                delay = base_delay * (2 ** (attempt - 1))
                log(f"Nova tentativa em {delay}s.")
                time.sleep(delay)

    assert last_error is not None
    raise RuntimeError(f"Coleta falhou apos {max_attempts} tentativas: {last_error}") from last_error


def enrich_manifest(metadata: dict) -> None:
    manifest_path = builder.OUTPUT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["transport"] = metadata
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main() -> int:
    worker_url = os.environ.get("TSE_FINANCE_WORKER_URL", DEFAULT_WORKER_URL).strip()
    token = os.environ.get("TSE_WORKER_TOKEN", "")
    attempts = 0

    try:
        transport, attempts = download_with_retry(worker_url, token, ZIP_PATH)
        with tempfile.TemporaryDirectory(prefix="eleicoes-financas-2026-") as temp:
            target = Path(temp)
            with zipfile.ZipFile(ZIP_PATH) as archive:
                archive.extractall(target)
            manifest = builder.process(target)
        enrich_manifest(transport)

        if int(manifest.get("candidates", 0)) <= 0:
            raise RuntimeError("A carga foi processada sem nenhum candidato com movimentacao.")
        if int(manifest.get("shard_count", 0)) <= 0:
            raise RuntimeError("A carga foi processada sem shards publicaveis.")

        write_status(
            "ok",
            attempts=attempts,
            worker_url=worker_url,
            transport=transport,
            manifest=manifest,
        )
        log(json.dumps(manifest, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        configured_attempts = max(
            1,
            int(os.environ.get("TSE_FINANCE_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS)),
        )
        write_status(
            "error",
            attempts=attempts or configured_attempts,
            worker_url=worker_url,
            error=error,
        )
        log(f"ERRO: carga financeira nao publicada: {error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
