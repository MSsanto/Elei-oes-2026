from __future__ import annotations

import csv
import io
import os
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

DEFAULT_WORKER_URL = "https://eleicoes-2026-tse-browser-probe.matheus-sergio.workers.dev/download"
TOKENS = ("DOMIC", "MUNIC", "ZONA", "TITULO", "ELEITOR", "UE")


def decode(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")


def download() -> Path:
    base_url = os.environ.get("TSE_WORKER_URL", DEFAULT_WORKER_URL).strip()
    token = os.environ.get("TSE_WORKER_TOKEN", "").strip()
    if not token:
        raise RuntimeError("TSE_WORKER_TOKEN ausente")

    separator = "&" if "?" in base_url else "?"
    url = f"{base_url}{separator}{urllib.parse.urlencode({'dataset': 'complementar'})}"
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/zip",
            "User-Agent": "Eleicoes-2026-Diagnostico/1.1",
        },
    )

    target = Path(tempfile.gettempdir()) / "consulta_cand_complementar_2026.zip"
    try:
        with urllib.request.urlopen(request, timeout=150) as response:
            dataset_header = (response.headers.get("X-TSE-Dataset") or "").strip().lower()
            disposition = response.headers.get("Content-Disposition") or ""
            payload = response.read()
    except urllib.error.HTTPError as error:
        body = error.read(400).decode("utf-8", errors="replace")
        raise RuntimeError(f"Worker retornou HTTP {error.code}: {body}") from error

    # Evita falso positivo quando uma versão antiga do Worker ignora ?dataset=complementar
    # e devolve silenciosamente o ZIP principal de candidaturas.
    if dataset_header != "complementar":
        raise RuntimeError(
            "Worker ativo não confirmou o dataset complementar: "
            f"X-TSE-Dataset={dataset_header!r}, Content-Disposition={disposition!r}. "
            "Aguarde o deploy do Worker e execute o diagnóstico novamente."
        )

    target.write_bytes(payload)
    with target.open("rb") as handle:
        if not handle.read(4).startswith(b"PK"):
            raise RuntimeError("Resposta recebida nao e ZIP")
    return target


def main() -> int:
    path = download()
    print(f"ZIP complementar recebido: {path.stat().st_size} bytes")

    with zipfile.ZipFile(path) as archive:
        csv_names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        complementary_names = [
            name for name in csv_names
            if "consulta_cand_complementar_2026" in Path(name).name.lower()
        ]
        if not complementary_names:
            raise RuntimeError(
                "O Worker confirmou 'complementar', mas o ZIP não contém arquivos "
                "consulta_cand_complementar_2026*.csv. Diagnóstico interrompido."
            )

        print(f"Arquivos CSV no ZIP: {len(csv_names)}")
        for name in csv_names:
            print(f"- {name}")

        brasil = next(
            (name for name in complementary_names if Path(name).name.upper() == "CONSULTA_CAND_COMPLEMENTAR_2026_BRASIL.CSV"),
            None,
        )
        selected = brasil or complementary_names[0]

        reader = csv.reader(io.StringIO(decode(archive.read(selected))), delimiter=";")
        headers = next(reader, [])

    print(f"\nArquivo analisado: {selected}")
    print(f"Total de colunas: {len(headers)}")
    print("\nCabecalhos:")
    for header in headers:
        print(f"- {header}")

    relevant = [header for header in headers if any(token in header.upper() for token in TOKENS)]
    print("\nColunas potencialmente relacionadas a domicilio/municipio/eleitorado:")
    if relevant:
        for header in relevant:
            print(f"- {header}")
    else:
        print("- nenhuma")

    print("\nDiagnostico concluido. Nenhum registro individual foi exibido ou publicado.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERRO: {error}", file=sys.stderr)
        raise SystemExit(1)
