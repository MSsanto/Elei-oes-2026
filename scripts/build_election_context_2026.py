#!/usr/bin/env python3
"""Gera contexto eleitoral 2026 a partir de fontes oficiais do TSE."""

from __future__ import annotations

import csv
import io
import json
import os
import tempfile
import unicodedata
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
OUTPUT = PROCESSED / "election-context.json"
RAW_DIR = ROOT / "data" / "raw" / "contexto-eleitoral"
RAW_VAGAS = RAW_DIR / "consulta_vagas_2026.zip"
RAW_ELEITORADO = RAW_DIR / "perfil_eleitorado_2026.zip"

VAGAS_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_vagas/consulta_vagas_2026.zip"
ELEITORADO_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitorado/perfil_eleitorado_2026.zip"
UFS = ("AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO")
CARGOS = {
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


def source_bytes(path: Path, url: str) -> bytes:
    if path.exists():
        payload = path.read_bytes()
    else:
        request = urllib.request.Request(url, headers={"User-Agent": "Eleicoes-2026-Transparencia/1.0"})
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = response.read()
    if not payload.startswith(b"PK"):
        raise ValueError(f"Fonte não possui assinatura ZIP: {path.name}")
    return payload


def decode_csv(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("CSV do TSE não pôde ser decodificado")


def rows_from_zip(payload: bytes, required: set[str]) -> tuple[list[dict[str, str]], str]:
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        for name in sorted((item for item in archive.namelist() if item.lower().endswith(".csv")), key=len):
            reader = csv.DictReader(io.StringIO(decode_csv(archive.read(name))), delimiter=";")
            fields = {str(field or "").lstrip("\ufeff").strip() for field in (reader.fieldnames or [])}
            if required.issubset(fields):
                return [
                    {str(key or "").lstrip("\ufeff").strip(): value for key, value in row.items()}
                    for row in reader
                ], name
    raise ValueError(f"Nenhum CSV contém as colunas obrigatórias: {sorted(required)}")


def source_timestamp(rows: list[dict[str, str]]) -> str | None:
    if not rows:
        return None
    return " ".join(part for part in ((rows[0].get("DT_GERACAO") or "").strip(), (rows[0].get("HH_GERACAO") or "").strip()) if part) or None


def candidate_counts() -> dict[str, dict[str, int]]:
    output: dict[str, dict[str, int]] = {}
    for cargo in ("presidente", "governador", "senador", "deputado-estadual"):
        manifest = read_json(PROCESSED / "candidatos" / cargo / "manifest.json")
        if not isinstance(manifest, dict):
            raise ValueError(f"Manifesto inválido: {cargo}")
        scopes = {"BR": int(manifest.get("total") or 0)}
        for uf, entry in (manifest.get("ufs") or {}).items():
            if uf in UFS and isinstance(entry, dict):
                scopes[uf] = int(entry.get("total") or 0)
        output[cargo] = scopes

    federal = read_json(PROCESSED / "deputados_federais.json")
    if not isinstance(federal, list):
        raise ValueError("Base de deputados federais inválida")
    by_uf = defaultdict(int)
    for item in federal:
        uf = str((item or {}).get("uf") or "").upper()
        if uf in UFS:
            by_uf[uf] += 1
    output["deputado-federal"] = {"BR": len(federal), **{uf: by_uf[uf] for uf in UFS}}
    return output


def seats() -> tuple[dict[str, dict[str, int]], dict[str, object]]:
    rows, filename = rows_from_zip(source_bytes(RAW_VAGAS, VAGAS_URL), {"SG_UF", "DS_CARGO", "QT_VAGAS"})
    cargo_map = {
        "PRESIDENTE": "presidente",
        "GOVERNADOR": "governador",
        "SENADOR": "senador",
        "DEPUTADO FEDERAL": "deputado-federal",
        "DEPUTADO ESTADUAL": "deputado-estadual",
        "DEPUTADO DISTRITAL": "deputado-estadual",
    }
    values = {cargo: defaultdict(int) for cargo in CARGOS}
    for row in rows:
        if row.get("ANO_ELEICAO") and str(row["ANO_ELEICAO"]).strip() != "2026":
            continue
        cargo = cargo_map.get(normalize(row.get("DS_CARGO")))
        if not cargo:
            continue
        uf = str(row.get("SG_UF") or "").strip().upper()
        scope = "BR" if cargo == "presidente" else uf
        if scope != "BR" and scope not in UFS:
            continue
        # O mesmo cargo/circunscrição pode aparecer repetido por metadados da eleição.
        # A quantidade oficial de vagas é o valor do registro, não a soma das duplicatas.
        values[cargo][scope] = max(values[cargo][scope], as_int(row.get("QT_VAGAS")))

    for cargo in ("governador", "senador", "deputado-federal", "deputado-estadual"):
        values[cargo]["BR"] = sum(values[cargo][uf] for uf in UFS)
    result = {cargo: dict(scopes) for cargo, scopes in values.items()}
    expected = {"presidente": 1, "governador": 27, "senador": 54, "deputado-federal": 513, "deputado-estadual": 1059}
    for cargo, total in expected.items():
        if result.get(cargo, {}).get("BR") != total:
            raise ValueError(f"Total de vagas inesperado para {cargo}: {result.get(cargo, {}).get('BR')}; esperado: {total}")
    if result["deputado-estadual"].get("DF") != 24:
        raise ValueError("Total de vagas de deputado distrital no DF diferente de 24")
    return result, {"url": VAGAS_URL, "file": filename, "source_generated_at": source_timestamp(rows)}


def electorate() -> tuple[dict[str, int], dict[str, object]]:
    rows, filename = rows_from_zip(source_bytes(RAW_ELEITORADO, ELEITORADO_URL), {"SG_UF", "QT_ELEITORES_PERFIL"})
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
    result = {"BR": national, **{uf: totals[uf] for uf in UFS}, "ZZ": totals["ZZ"]}
    return result, {"url": ELEITORADO_URL, "file": filename, "source_generated_at": source_timestamp(rows)}


def ratio(candidates: int, vacancy_count: int) -> float | None:
    return round(candidates / vacancy_count, 2) if vacancy_count > 0 else None


def previous_or_unavailable(error: Exception) -> dict[str, object]:
    if OUTPUT.exists():
        try:
            previous = read_json(OUTPUT)
            if isinstance(previous, dict) and previous.get("status") == "ready":
                previous["fallback_used"] = True
                previous["fallback_reason"] = str(error)
                return previous
        except (OSError, ValueError, json.JSONDecodeError):
            pass
    return {
        "schema_version": 1,
        "status": "awaiting_official_context_source",
        "generated_at_utc": None,
        "cargos": {},
        "electorate": {"BR": 0, "ufs": {}, "exterior": 0},
        "fallback_used": True,
        "fallback_reason": str(error),
        "notes": ["Nenhum número é publicado enquanto a carga oficial não passar pelas validações."],
    }


def build() -> dict[str, object]:
    candidates = candidate_counts()
    try:
        vacancy_data, vacancy_source = seats()
        electorate_data, electorate_source = electorate()
    except (OSError, ValueError, zipfile.BadZipFile, urllib.error.URLError) as error:
        return previous_or_unavailable(error)

    cargos: dict[str, object] = {}
    for cargo, label in CARGOS.items():
        scopes = {}
        for scope in (["BR"] if cargo == "presidente" else ["BR", *UFS]):
            candidate_count = int(candidates.get(cargo, {}).get(scope) or 0)
            seat_count = int(vacancy_data.get(cargo, {}).get(scope) or 0)
            if scope != "BR" and candidate_count == 0 and seat_count == 0:
                continue
            scopes[scope] = {
                "candidates": candidate_count,
                "seats": seat_count,
                "candidates_per_seat": ratio(candidate_count, seat_count),
                "eligible_voters": int(electorate_data.get(scope) or 0),
            }
        cargos[cargo] = {"label": label, "scopes": scopes}

    return {
        "schema_version": 1,
        "status": "ready",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": "contagem_descritiva_sem_ranking",
        "cargos": cargos,
        "electorate": {
            "BR": electorate_data["BR"],
            "ufs": {uf: electorate_data[uf] for uf in UFS},
            "exterior": electorate_data.get("ZZ", 0),
        },
        "sources": {
            "candidates": {"name": "TSE — Candidatos 2026", "url": "https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026"},
            "seats": {"name": "TSE — Vagas 2026", **vacancy_source},
            "electorate": {"name": "TSE — Eleitorado 2026", **electorate_source},
        },
        "fallback_used": False,
        "notes": [
            "Candidaturas correspondem aos registros presentes na carga eleitoral do projeto, sem exclusão por situação do registro.",
            "Candidaturas por vaga é uma divisão aritmética descritiva e não mede chance de eleição ou competitividade.",
            "O total nacional de eleitorado inclui o exterior quando a fonte oficial o identifica como ZZ.",
        ],
    }


def write_atomic(payload: dict[str, object]) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix="election-context-", suffix=".json", dir=OUTPUT.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temp_name, OUTPUT)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def main() -> None:
    payload = build()
    write_atomic(payload)
    if payload.get("status") == "ready":
        print(f"Contexto eleitoral gerado: eleitorado={payload['electorate']['BR']:,}")
    else:
        print(f"Contexto eleitoral indisponível: {payload.get('fallback_reason', 'sem detalhe')}")


if __name__ == "__main__":
    main()
