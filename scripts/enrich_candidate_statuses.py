from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import fetch_candidates as base

YEAR = 2026
ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
STATUS_DIR = PROCESSED / "status-candidaturas"
STATUS_SNAPSHOT = STATUS_DIR / "statuses.json"
STATUS_MANIFEST = STATUS_DIR / "manifest.json"
SOURCE_NAME = "DivulgaCandContas — Tribunal Superior Eleitoral (TSE)"
SOURCE_URL = "https://divulgacandcontas.tse.jus.br/divulga/"

# Cada consulta corresponde a uma circunscrição/cargo da eleição geral.
QUERY_PLAN = [
    ("BR", "1", "Presidente"),
    *((uf, "3", "Governador") for uf in base.UFS),
    *((uf, "5", "Senador") for uf in base.UFS),
    *((uf, "6", "Deputado Federal") for uf in base.UFS),
    *((uf, "7", "Deputado Estadual") for uf in base.UFS if uf != "DF"),
    ("DF", "8", "Deputado Distrital"),
]


@dataclass(frozen=True)
class QueryResult:
    unit: str
    cargo_code: str
    cargo_label: str
    records: dict[str, dict[str, str]]


def log(message: str) -> None:
    print(message, flush=True)


def text(value: object = "") -> str:
    return str(value or "").strip()


def readable(value: object = "") -> str:
    value_text = text(value)
    if not value_text or value_text.startswith("#"):
        return ""
    return value_text


def first_readable(item: dict[str, object], *names: str) -> str:
    for name in names:
        value = readable(item.get(name))
        if value:
            return value
    return ""


def first_text(item: dict[str, object], *names: str) -> str:
    for name in names:
        value = text(item.get(name))
        if value:
            return value
    return ""


def normalize_candidate_id(item: dict[str, object]) -> str:
    candidate_id = first_text(item, "id", "sq_CANDIDATO", "sqCandidato", "SQ_CANDIDATO")
    return candidate_id if candidate_id.isdigit() else ""


def normalize_listing_payload(payload: object) -> list[dict[str, object]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        raw = payload.get("candidatos") or payload.get("candidates") or []
        return [item for item in raw if isinstance(item, dict)] if isinstance(raw, list) else []
    return []


def normalize_status_record(item: dict[str, object], *, collected_at: str) -> tuple[str, dict[str, str]] | None:
    candidate_id = normalize_candidate_id(item)
    if not candidate_id:
        return None

    status = first_readable(
        item,
        "descricaoSituacao",
        "situacaoCandidato",
        "descricaoSituacaoCandidato",
        "DS_SITUACAO_CANDIDATURA",
    )
    if not status:
        return None

    detail = first_readable(item, "descricaoSituacaoCandidato")
    if detail.casefold() == status.casefold():
        detail = ""

    return candidate_id, {
        "situacao_candidatura": status,
        "situacao_candidatura_detalhe": detail,
        "situacao_candidatura_codigo": first_text(
            item,
            "codigoSituacao",
            "codigoSituacaoCandidato",
            "CD_SITUACAO_CANDIDATURA",
        ),
        "situacao_candidatura_fonte": SOURCE_NAME,
        "situacao_candidatura_fonte_url": SOURCE_URL,
        "situacao_candidatura_atualizacao": first_text(
            item,
            "dataUltimaAtualizacao",
            "dt_ULTIMA_ATUALIZACAO",
            "DT_GERACAO",
        ),
        "situacao_candidatura_coletada_em_utc": collected_at,
    }


def fetch_query(unit: str, cargo_code: str, cargo_label: str, election_id: int, *, collected_at: str) -> QueryResult:
    url = f"{base.BASE_URL}/candidatura/listar/{YEAR}/{unit}/{election_id}/{cargo_code}/candidatos"
    payload = base.fetch_json(url, attempts=3)
    records: dict[str, dict[str, str]] = {}
    for item in normalize_listing_payload(payload):
        normalized = normalize_status_record(item, collected_at=collected_at)
        if normalized:
            candidate_id, status = normalized
            records[candidate_id] = status
    log(f"Situação TSE: {cargo_label} / {unit}: {len(records)} registros legíveis")
    return QueryResult(unit=unit, cargo_code=cargo_code, cargo_label=cargo_label, records=records)


def merge_results(results: Iterable[QueryResult]) -> dict[str, dict[str, str]]:
    merged: dict[str, dict[str, str]] = {}
    for result in results:
        for candidate_id, record in result.records.items():
            previous = merged.get(candidate_id)
            if previous and previous.get("situacao_candidatura") != record.get("situacao_candidatura"):
                raise RuntimeError(
                    f"SQ_CANDIDATO {candidate_id} retornou situações divergentes na mesma coleta: "
                    f"{previous.get('situacao_candidatura')!r} x {record.get('situacao_candidatura')!r}"
                )
            merged[candidate_id] = record
    return merged


def load_previous_snapshot() -> dict[str, dict[str, str]]:
    if not STATUS_SNAPSHOT.exists():
        return {}
    try:
        payload = json.loads(STATUS_SNAPSHOT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        log(f"Aviso: snapshot anterior de situação não pôde ser lido: {error}")
        return {}
    if not isinstance(payload, dict):
        return {}
    return {
        str(candidate_id): record
        for candidate_id, record in payload.items()
        if str(candidate_id).isdigit() and isinstance(record, dict)
    }


def collect_live_snapshot() -> tuple[dict[str, dict[str, str]] | None, dict[str, object]]:
    collected_at = datetime.now(timezone.utc).isoformat()
    election_id = base.discover_election_id()
    results: list[QueryResult] = []
    failures: list[dict[str, str]] = []

    for index, (unit, cargo_code, cargo_label) in enumerate(QUERY_PLAN):
        try:
            results.append(fetch_query(unit, cargo_code, cargo_label, election_id, collected_at=collected_at))
        except Exception as error:  # fonte externa: não publica snapshot parcial como se fosse completo
            failures.append({
                "unidade": unit,
                "cargo_codigo": cargo_code,
                "cargo": cargo_label,
                "erro": str(error)[:500],
            })
            log(f"Aviso: falha ao consultar situação de {cargo_label}/{unit}: {error}")
        if index + 1 < len(QUERY_PLAN):
            time.sleep(0.08)

    metadata: dict[str, object] = {
        "source": SOURCE_NAME,
        "source_url": SOURCE_URL,
        "election_id": election_id,
        "collected_at_utc": collected_at,
        "queries_expected": len(QUERY_PLAN),
        "queries_succeeded": len(results),
        "queries_failed": len(failures),
        "failures": failures,
    }
    if failures:
        return None, metadata

    snapshot = merge_results(results)
    metadata["records"] = len(snapshot)
    return snapshot, metadata


def write_json_atomic(path: Path, payload: object, *, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=2 if pretty else None,
            separators=None if pretty else (",", ":"),
        ),
        encoding="utf-8",
    )
    temporary.replace(path)


def iter_candidate_json_files() -> Iterable[Path]:
    federal = PROCESSED / "deputados_federais.json"
    if federal.exists():
        yield federal

    candidate_root = PROCESSED / "candidatos"
    if not candidate_root.exists():
        return

    for path in candidate_root.rglob("*.json"):
        if path.name == "manifest.json":
            continue
        yield path


def enrich_candidate(item: dict[str, object], snapshot: dict[str, dict[str, str]]) -> bool:
    candidate_id = text(item.get("id_tse") or item.get("sq_candidato") or item.get("SQ_CANDIDATO"))
    record = snapshot.get(candidate_id)
    if not record:
        return False

    changed = False
    for key, value in record.items():
        if value and item.get(key) != value:
            item[key] = value
            changed = True

    status_date = text(record.get("situacao_candidatura_atualizacao"))
    if status_date and item.get("ultima_atualizacao_tse") != status_date:
        item["ultima_atualizacao_tse"] = status_date
        changed = True
    return changed


def apply_snapshot(snapshot: dict[str, dict[str, str]]) -> dict[str, int]:
    stats = {"files_scanned": 0, "files_changed": 0, "candidate_rows_enriched": 0}
    for path in iter_candidate_json_files():
        stats["files_scanned"] += 1
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"JSON inválido ao aplicar situação: {path}: {error}") from error

        if not isinstance(payload, list):
            continue
        changed = False
        for item in payload:
            if isinstance(item, dict) and enrich_candidate(item, snapshot):
                changed = True
                stats["candidate_rows_enriched"] += 1
        if changed:
            write_json_atomic(path, payload)
            stats["files_changed"] += 1
    return stats


def main() -> int:
    previous = load_previous_snapshot()
    live_snapshot: dict[str, dict[str, str]] | None = None
    collection_meta: dict[str, object] = {}

    try:
        live_snapshot, collection_meta = collect_live_snapshot()
    except Exception as error:
        collection_meta = {
            "source": SOURCE_NAME,
            "source_url": SOURCE_URL,
            "collected_at_utc": datetime.now(timezone.utc).isoformat(),
            "error": str(error)[:1000],
        }
        log(f"Aviso: coleta de situação não pôde ser concluída: {error}")

    fallback_used = live_snapshot is None
    snapshot = previous if fallback_used else live_snapshot

    if not snapshot:
        log(
            "Nenhum snapshot legível de situação está disponível. "
            "A carga eleitoral será mantida sem inferir aptidão ou inaptidão."
        )
        manifest = {
            "version": 1,
            **collection_meta,
            "fallback_used": fallback_used,
            "snapshot_records": 0,
            "applied": False,
            "policy": "sem_inferencia_na_ausencia_de_status_legivel",
        }
        write_json_atomic(STATUS_MANIFEST, manifest, pretty=True)
        return 0

    if not fallback_used:
        write_json_atomic(STATUS_SNAPSHOT, snapshot, pretty=True)

    stats = apply_snapshot(snapshot)
    manifest = {
        "version": 1,
        **collection_meta,
        "fallback_used": fallback_used,
        "snapshot_records": len(snapshot),
        "applied": True,
        "policy": "situacao_oficial_sem_classificacao_editorial",
        **stats,
    }
    write_json_atomic(STATUS_MANIFEST, manifest, pretty=True)

    if fallback_used:
        log(
            f"Situações aplicadas a partir do snapshot anterior ({len(snapshot)} registros); "
            "a coleta atual não substituiu a última base válida."
        )
    else:
        log(f"Situações oficiais atualizadas: {len(snapshot)} registros no snapshot.")
    log(
        f"Aplicação concluída: {stats['candidate_rows_enriched']} linhas enriquecidas em "
        f"{stats['files_changed']} arquivos."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
