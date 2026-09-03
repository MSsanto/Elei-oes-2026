#!/usr/bin/env python3
"""Aplica às candidaturas de 2026 o mapa histórico de votação por DDD de 2022.

Este script NÃO descobre domicílio eleitoral. Ele apenas reaplica um mapa já
construído com votos nominais oficiais do TSE por município e Código Nacional
(DDD) oficial da Anatel.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
CANDIDATES_FILE = PROCESSED / "deputados_federais.json"
UF_DIR = PROCESSED / "ufs"
META_FILE = PROCESSED / "metadata.json"
HISTORY_FILE = PROCESSED / "territorio" / "historico_ddd_2022.json"
FIELD = "historico_eleitoral_2022"


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_candidates(candidates: list[dict]) -> None:
    CANDIDATES_FILE.write_text(
        json.dumps(candidates, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    UF_DIR.mkdir(parents=True, exist_ok=True)
    grouped: dict[str, list[dict]] = defaultdict(list)
    for candidate in candidates:
        grouped[str(candidate.get("uf") or "")].append(candidate)
    for uf, records in grouped.items():
        if uf:
            (UF_DIR / f"{uf}.json").write_text(
                json.dumps(records, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )


def apply_history() -> dict[str, int]:
    candidates = load_json(CANDIDATES_FILE, [])
    if not isinstance(candidates, list) or not candidates:
        raise RuntimeError(f"Base de candidaturas ausente ou vazia: {CANDIDATES_FILE}")

    history = load_json(HISTORY_FILE, {})
    records = history.get("records", {}) if isinstance(history, dict) else {}
    if not isinstance(records, dict):
        records = {}

    applied = 0
    with_principal_ddd = 0
    for candidate in candidates:
        candidate.pop(FIELD, None)
        candidate_id = str(candidate.get("id_tse") or "")
        historical = records.get(candidate_id)
        if not isinstance(historical, dict):
            continue
        candidate[FIELD] = historical
        applied += 1
        if historical.get("ddds_principais") or historical.get("ddd_principal"):
            with_principal_ddd += 1

    write_candidates(candidates)

    metadata = load_json(META_FILE, {})
    if not isinstance(metadata, dict):
        metadata = {}
    map_meta = history.get("metadata", {}) if isinstance(history, dict) else {}
    metadata["regionalizacao_historica"] = {
        "tipo": "DDD principal da votação nominal para Deputado Federal em 2022",
        "ano_referencia": 2022,
        "fonte_votos": "Tribunal Superior Eleitoral (TSE) — Resultados 2022",
        "fonte_ddd": "Agência Nacional de Telecomunicações (Anatel) — Códigos Nacionais",
        "metodologia_vinculo": (
            "nome civil + data de nascimento + gênero; correspondência normalizada, exata e única entre 2026 e 2022"
        ),
        "candidaturas_com_historico_confirmado": applied,
        "candidaturas_com_ddd_principal": with_principal_ddd,
        "mapa_gerado_em_utc": map_meta.get("generated_at_utc"),
        "nota": (
            "Referência histórica de votação. Não representa domicílio eleitoral, residência, endereço "
            "ou área atual de atuação política."
        ),
    }
    META_FILE.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    return {"applied": applied, "with_principal_ddd": with_principal_ddd, "candidates": len(candidates)}


def main() -> int:
    if not HISTORY_FILE.exists():
        print(
            "Histórico DDD 2022 ainda não construído. A coleta 2026 seguirá normalmente; "
            "execute o workflow manual de construção histórica para habilitar o filtro."
        )
        return 0

    result = apply_history()
    print(
        "Histórico DDD aplicado: "
        f"{result['applied']}/{result['candidates']} candidaturas; "
        f"{result['with_principal_ddd']} com DDD principal confirmado."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
