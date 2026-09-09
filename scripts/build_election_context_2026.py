#!/usr/bin/env python3
"""Gera contexto eleitoral 2026 a partir de fontes oficiais do TSE.

Saída: data/processed/election-context.json

O arquivo combina contagens de candidaturas já processadas pelo projeto com:
- consulta_vagas_2026.zip (TSE)
- perfil_eleitorado_2026.zip (TSE)

A relação candidaturas/vaga é apenas uma razão descritiva. Não representa
probabilidade de eleição, competitividade, qualidade ou recomendação.
"""

from __future__ import annotations

import csv
import io
import json
import os
import tempfile
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
OUTPUT = PROCESSED / "election-context.json"

VAGAS_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_vagas/consulta_vagas_2026.zip"
ELEITORADO_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitorado/perfil_eleitorado_2026.zip"

UFS = (
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
    "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
    "SP", "SE", "TO",
)

CARGO_LABELS = {
    "presidente": "Presidente",
    "governador": "Governador",
    "senador": "Senador",
    "deputado-federal": "Deputado Federal",
    "deputado-estadual": "Deputado Estadual / Distrital",
}


def normalize(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(ch for ch in text if not unicodedata.combining(ch)).strip().upper()


def as_int(value: object) -> int:
    text = str(value or "0").strip().replace(".", "").replace(",", ".")
    try:
        return int(float(text))
    except ValueError:
        return 0


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def download(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Eleicoes-2026-Transparencia/1.0 (+https://github.com/MSsanto/Elei-oes-2026)"},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        return response.read()


def decode_csv(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("CSV do TSE não pôde ser decodificado")


def csv_rows_from_zip(payload: bytes, required_columns: set[str]) -> tuple[list[dict[str, str]], str]:
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        candidates = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        if not candidates:
            raise ValueError("ZIP do TSE não contém CSV")

        for name in sorted(candidates, key=lambda item: ("2026.csv" not in item.lower(), len(item))):
            text = decode_csv(archive.read(name))
            reader = csv.DictReader(io.StringIO(text), delimiter=";")
            fields = {str(field or "").lstrip("\ufeff").strip() for field in (reader.fieldnames or [])}
            if required_columns.issubset(fields):
                rows = []
                for row in reader:
                    rows.append({str(key or "").lstrip("\ufeff").strip(): value for key, value in row.items()})
                return rows, name

    raise ValueError(f"Nenhum CSV contém as colunas obrigatórias: {sorted(required_columns)}")


def source_timestamp(rows: list[dict[str, str]]) -> str | None:
    if not rows:
        return None
    date = (rows[0].get("DT_GERACAO") or "").strip()
    time = (rows[0].get("HH_GERACAO") or "").strip()
    return " ".join(part for part in (date, time) if part) or None


def load_candidate_counts() -> dict[str, dict[str, int]]:
    counts: dict[str, dict[str, int]] = {}

    for cargo in ("presidente", "governador", "senador", "deputado-estadual"):
        manifest = read_json(PROCESSED / "candidatos" / cargo / "manifest.json")
        if not isinstance(manifest, dict):
            raise ValueError(f"Manifesto inválido: {cargo}")
        by_scope = {"BR": int(manifest.get("total") or 0)}
        for uf, entry in (manifest.get("ufs") or {}).items():
            if uf in UFS and isinstance(entry, dict):
                by_scope[uf] = int(entry.get("total") or 0)
        counts[cargo] = by_scope

    federal = read_json(PROCESSED / "deputados_federais.json")
    if not isinstance(federal, list):
        raise ValueError("Base de deputados federais inválida")
    federal_ufs = defaultdict(int)
    for candidate in federal:
        uf = str((candidate or {}).get("uf") or "").upper()
        if uf in UFS:
            federal_ufs[uf] += 1
    counts["deputado-federal"] = {"BR": len(federal), **{uf: federal_ufs[uf] for uf in UFS}}

    return counts


def load_seats() -> tuple[dict[str, dict[str, int]], dict[str, object]]:
    raw = download(VAGAS_URL)
    rows, filename = csv_rows_from_zip(raw, {"SG_UF", "DS_CARGO", "QT_VAGAS"})

    seats = {cargo: defaultdict(int) for cargo in CARGO_LABELS}
    seen: set[tuple[str, ...]] = set()

    cargo_map = {
        "PRESIDENTE": "presidente",
        "GOVERNADOR": "governador",
        "SENADOR": "senador",
        "DEPUTADO FEDERAL": "deputado-federal",
        "DEPUTADO ESTADUAL": "deputado-estadual",
        "DEPUTADO DISTRITAL": "deputado-estadual",
    }

    for row in rows:
        if row.get("ANO_ELEICAO") and str(row["ANO_ELEICAO"]).strip() != "2026":
            continue
        cargo_name = normalize(row.get("DS_CARGO"))
        cargo = cargo_map.get(cargo_name)
        if not cargo:
            continue
        uf = str(row.get("SG_UF") or "").strip().upper()
        if cargo == "presidente":
            scope = "BR"
        elif uf in UFS:
            scope = uf
        else:
            continue
        value = as_int(row.get("QT_VAGAS"))
        if value <= 0:
            continue
        dedupe = (
            str(row.get("CD_ELEICAO") or ""),
            str(row.get("NR_TURNO") or ""),
            str(row.get("SG_UE") or ""),
            scope,
            cargo_name,
            str(value),
        )
        if dedupe in seen:
            continue
        seen.add(dedupe)
        seats[cargo][scope] += value

    for cargo in ("governador", "senador", "deputado-federal", "deputado-estadual"):
        seats[cargo]["BR"] = sum(seats[cargo][uf] for uf in UFS)

    normalized = {cargo: dict(values) for cargo, values in seats.items()}
    validate_seats(normalized)
    return normalized, {"url": VAGAS_URL, "file": filename, "source_generated_at": source_timestamp(rows)}


def validate_seats(seats: dict[str, dict[str, int]]) -> None:
    expected = {
        "presidente": 1,
        "governador": 27,
        "senador": 54,
        "deputado-federal": 513,
        "deputado-estadual": 1059,
    }
    for cargo, total in expected.items():
        actual = int(seats.get(cargo, {}).get("BR") or 0)
        if actual != total:
            raise ValueError(f"Total de vagas inesperado para {cargo}: {actual}; esperado: {total}")
    if seats["deputado-estadual"].get("DF") != 24:
        raise ValueError("Total de vagas de deputado distrital no DF diferente de 24")


def load_electorate() -> tuple[dict[str, int], dict[str, object]]:
    raw = download(ELEITORADO_URL)
    rows, filename = csv_rows_from_zip(raw, {"SG_UF", "QT_ELEITORES_PERFIL"})
    totals = defaultdict(int)

    for row in rows:
        if row.get("ANO_ELEICAO") and str(row["ANO_ELEICAO"]).strip() != "2026":
            continue
        uf = str(row.get("SG_UF") or "").strip().upper()
        if uf in UFS or uf == "ZZ":
            totals[uf] += as_int(row.get("QT_ELEITORES_PERFIL"))

    missing = [uf for uf in UFS if totals[uf] <= 0]
    if missing:
        raise ValueError(f"Eleitorado ausente para UFs: {', '.join(missing)}")

    national = sum(totals[uf] for uf in UFS) + totals["ZZ"]
    if not 150_000_000 <= national <= 170_000_000:
        raise ValueError(f"Total nacional de eleitorado fora da faixa de validação: {national}")

    output = {"BR": national, **{uf: totals[uf] for uf in UFS}}
    if totals["ZZ"]:
        output["ZZ"] = totals["ZZ"]
    return output, {"url": ELEITORADO_URL, "file": filename, "source_generated_at": source_timestamp(rows)}


def ratio(candidates: int, seats: int) -> float | None:
    return round(candidates / seats, 2) if seats > 0 else None


def build_payload() -> dict[str, object]:
    candidates = load_candidate_counts()
    seats, seats_source = load_seats()
    electorate, electorate_source = load_electorate()

    cargos: dict[str, object] = {}
    for cargo, label in CARGO_LABELS.items():
        scopes: dict[str, object] = {}
        available_scopes = ["BR"] if cargo == "presidente" else ["BR", *UFS]
        for scope in available_scopes:
            candidate_count = int(candidates.get(cargo, {}).get(scope) or 0)
            seat_count = int(seats.get(cargo, {}).get(scope) or 0)
            if scope != "BR" and candidate_count == 0 and seat_count == 0:
                continue
            scopes[scope] = {
                "candidates": candidate_count,
                "seats": seat_count,
                "candidates_per_seat": ratio(candidate_count, seat_count),
                "eligible_voters": int(electorate.get(scope) or 0),
            }
        cargos[cargo] = {"label": label, "scopes": scopes}

    return {
        "schema_version": 1,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": "contagem_descritiva_sem_ranking",
        "cargos": cargos,
        "electorate": {
            "BR": electorate["BR"],
            "ufs": {uf: electorate[uf] for uf in UFS},
            "exterior": electorate.get("ZZ", 0),
        },
        "sources": {
            "candidates": {
                "name": "TSE — Candidatos 2026 (base processada pelo projeto)",
                "url": "https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026",
            },
            "seats": {"name": "TSE — Vagas 2026", **seats_source},
            "electorate": {"name": "TSE — Eleitorado 2026", **electorate_source},
        },
        "notes": [
            "Candidaturas correspondem aos registros presentes na carga eleitoral do projeto, sem exclusão por situação do registro.",
            "Candidaturas por vaga é uma divisão aritmética descritiva e não mede chance de eleição ou competitividade.",
            "O total nacional de eleitorado inclui o exterior quando a fonte oficial o identifica como ZZ.",
        ],
    }


def atomic_write(payload: dict[str, object]) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix="election-context-", suffix=".json", dir=OUTPUT.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary, OUTPUT)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main() -> None:
    payload = build_payload()
    atomic_write(payload)
    print(
        "Contexto eleitoral gerado: "
        f"eleitorado={payload['electorate']['BR']:,}, "
        f"arquivo={OUTPUT.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    main()
