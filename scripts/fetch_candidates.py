from __future__ import annotations

import csv
import json
import shutil
import unicodedata
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

TSE_CANDIDATES_URL = (
    "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/"
    "consulta_cand_2026.zip"
)

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
ZIP_PATH = RAW_DIR / "consulta_cand_2026.zip"
EXTRACT_DIR = RAW_DIR / "consulta_cand_2026"
OUTPUT_PATH = PROCESSED_DIR / "deputados_federais.json"
META_PATH = PROCESSED_DIR / "metadata.json"


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch)).strip().upper()


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Eleicoes-2026-Transparencia/0.1"},
    )
    with urllib.request.urlopen(request, timeout=180) as response, destination.open("wb") as out:
        shutil.copyfileobj(response, out)


def extract_zip(source: Path, destination: Path) -> None:
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source) as archive:
        archive.extractall(destination)


def iter_csv_files(directory: Path):
    yield from sorted(directory.rglob("*.csv"))


def pick(row: dict[str, str], *names: str) -> str:
    for name in names:
        if name in row and row[name] is not None:
            return row[name].strip()
    return ""


def read_deputies(csv_path: Path) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    with csv_path.open("r", encoding="latin-1", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        for row in reader:
            cargo = normalize_text(pick(row, "DS_CARGO"))
            if cargo != "DEPUTADO FEDERAL":
                continue

            records.append(
                {
                    "ano_eleicao": pick(row, "ANO_ELEICAO"),
                    "uf": pick(row, "SG_UF"),
                    "id_tse": pick(row, "SQ_CANDIDATO"),
                    "numero": pick(row, "NR_CANDIDATO"),
                    "nome": pick(row, "NM_CANDIDATO"),
                    "nome_urna": pick(row, "NM_URNA_CANDIDATO"),
                    "partido": pick(row, "SG_PARTIDO"),
                    "numero_partido": pick(row, "NR_PARTIDO"),
                    "situacao_candidatura": pick(
                        row,
                        "DS_SITUACAO_CANDIDATURA",
                        "DS_SITUACAO_CANDIDATO",
                    ),
                    "situacao_urna": pick(row, "DS_SITUACAO_CANDIDATO_URNA"),
                    "genero": pick(row, "DS_GENERO"),
                    "grau_instrucao": pick(row, "DS_GRAU_INSTRUCAO"),
                    "ocupacao": pick(row, "DS_OCUPACAO"),
                    "cor_raca": pick(row, "DS_COR_RACA"),
                    "data_nascimento": pick(row, "DT_NASCIMENTO"),
                    "email": pick(row, "NM_EMAIL"),
                }
            )
    return records


def main() -> None:
    print("Baixando candidaturas 2026 do TSE...")
    download(TSE_CANDIDATES_URL, ZIP_PATH)
    print("Extraindo arquivo...")
    extract_zip(ZIP_PATH, EXTRACT_DIR)

    deputies: list[dict[str, str]] = []
    files = list(iter_csv_files(EXTRACT_DIR))
    if not files:
        raise RuntimeError("Nenhum CSV foi encontrado no arquivo do TSE.")

    for csv_file in files:
        deputies.extend(read_deputies(csv_file))

    # Evita duplicidade caso o pacote contenha arquivos agregados e arquivos por UF.
    unique = {item["id_tse"]: item for item in deputies if item["id_tse"]}
    deputies = sorted(
        unique.values(),
        key=lambda item: (item["uf"], item["nome_urna"], item["id_tse"]),
    )

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(deputies, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    metadata = {
        "source": TSE_CANDIDATES_URL,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "cargo": "DEPUTADO FEDERAL",
        "records": len(deputies),
        "output": str(OUTPUT_PATH.relative_to(ROOT)).replace("\\", "/"),
    }
    META_PATH.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Concluído: {len(deputies)} candidaturas salvas em {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
