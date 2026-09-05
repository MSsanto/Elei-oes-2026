from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

import build_candidate_assets_2026 as builder

DEFAULT_WORKER_BASE = "https://eleicoes-2026-tse-browser-probe.matheus-sergio.workers.dev/download"
ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / ".collector" / "patrimonio-2026"
BROWSER_LAUNCH_SPACING_SECONDS = 22
RATE_LIMIT_RETRIES = 3

DATASETS = {
    "bens2026": ("bem_candidato_2026.zip", 10_000),
    "candidatos2022": ("consulta_cand_2022.zip", 100_000),
    "bens2022": ("bem_candidato_2022.zip", 10_000),
}


def log(message: str) -> None:
    print(message, flush=True)


def worker_url(base: str, dataset: str) -> str:
    parsed = urllib.parse.urlsplit(base)
    query = dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))
    query["dataset"] = dataset
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urllib.parse.urlencode(query), parsed.fragment))


def download(dataset: str, url: str, token: str, destination: Path, minimum: int) -> dict:
    if not token:
        raise RuntimeError("TSE_WORKER_TOKEN nao configurado no GitHub Actions.")

    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "Eleicoes-2026-Patrimonio/1.0",
            "Accept": "application/zip",
        },
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(destination.suffix + ".tmp")
    digest = hashlib.sha256()
    total = 0

    log(f"Baixando {dataset} via Browser Worker: {url}")
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
        body = error.read(1200).decode("utf-8", errors="replace")
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Worker retornou HTTP {error.code} para {dataset}: {body}") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Falha ao baixar {dataset} via Worker: {error}") from error

    if status != 200 or total < minimum:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Resposta invalida para {dataset}: status={status}, bytes={total}")
    with partial.open("rb") as handle:
        if not handle.read(4).startswith(b"PK"):
            partial.unlink(missing_ok=True)
            raise RuntimeError(f"Resposta de {dataset} nao possui assinatura ZIP.")

    local_sha256 = digest.hexdigest()
    if upstream_sha256 and upstream_sha256.lower() != local_sha256.lower():
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"SHA-256 divergente para {dataset}: worker={upstream_sha256} local={local_sha256}")

    partial.replace(destination)
    with zipfile.ZipFile(destination) as archive:
        bad_file = archive.testzip()
        if bad_file:
            destination.unlink(missing_ok=True)
            raise RuntimeError(f"ZIP {dataset} corrompido; primeiro arquivo invalido: {bad_file}")
        entries = len(archive.namelist())

    log(f"{dataset}: ZIP validado com {total} bytes, {entries} entradas, sha256={local_sha256}")
    return {
        "dataset": dataset,
        "transport": "cloudflare_browser_run_cdp",
        "transport_url": url,
        "source_url": source_url,
        "downloaded_bytes": total,
        "sha256": local_sha256,
        "content_type": content_type,
        "worker_revision": worker_revision,
        "archive_entries": entries,
    }


def is_browser_rate_limit(error: Exception) -> bool:
    message = str(error).lower()
    return "429" in message and ("rate limit" in message or "too many" in message or "new browser" in message)


def download_with_retry(dataset: str, url: str, token: str, destination: Path, minimum: int) -> dict:
    for attempt in range(RATE_LIMIT_RETRIES + 1):
        try:
            return download(dataset, url, token, destination, minimum)
        except RuntimeError as error:
            if not is_browser_rate_limit(error) or attempt >= RATE_LIMIT_RETRIES:
                raise
            wait_seconds = BROWSER_LAUNCH_SPACING_SECONDS * (attempt + 1)
            log(f"Limite temporario do Browser Run em {dataset}; nova tentativa apos {wait_seconds}s.")
            time.sleep(wait_seconds)
    raise RuntimeError(f"Falha inesperada ao baixar {dataset}.")


def enrich_manifest(transports: list[dict]) -> None:
    manifest_path = builder.OUTPUT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["transport"] = transports
    manifest["browser_launch_spacing_seconds"] = BROWSER_LAUNCH_SPACING_SECONDS
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    base = os.environ.get("TSE_ASSETS_WORKER_URL", DEFAULT_WORKER_BASE).strip()
    token = os.environ.get("TSE_WORKER_TOKEN", "").strip()
    transports = []
    paths = {}
    datasets = list(DATASETS.items())

    try:
        for index, (dataset, (filename, minimum)) in enumerate(datasets):
            destination = CACHE_DIR / filename
            url = worker_url(base, dataset)
            transports.append(download_with_retry(dataset, url, token, destination, minimum))
            paths[dataset] = destination
            if index < len(datasets) - 1:
                log(f"Aguardando {BROWSER_LAUNCH_SPACING_SECONDS}s antes da proxima instancia do Browser Run.")
                time.sleep(BROWSER_LAUNCH_SPACING_SECONDS)

        with tempfile.TemporaryDirectory(prefix="eleicoes-patrimonio-2026-") as temp:
            root = Path(temp)
            current = root / "bens-2026"
            candidates_2022 = root / "candidatos-2022"
            assets_2022 = root / "bens-2022"
            current.mkdir(); candidates_2022.mkdir(); assets_2022.mkdir()
            with zipfile.ZipFile(paths["bens2026"]) as archive:
                archive.extractall(current)
            with zipfile.ZipFile(paths["candidatos2022"]) as archive:
                archive.extractall(candidates_2022)
            with zipfile.ZipFile(paths["bens2022"]) as archive:
                archive.extractall(assets_2022)
            manifest = builder.process(current, candidates_2022, assets_2022)

        enrich_manifest(transports)
        if int(manifest.get("candidates", 0)) <= 0:
            raise RuntimeError("A carga de patrimonio foi processada sem candidaturas.")
        if int(manifest.get("shard_count", 0)) <= 0:
            raise RuntimeError("A carga de patrimonio foi processada sem shards publicaveis.")
        log(json.dumps(manifest, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        log(f"ERRO: carga de patrimonio nao publicada: {error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
