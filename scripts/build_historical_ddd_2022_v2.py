#!/usr/bin/env python3
"""Camada de correção para a regionalização histórica por DDD.

O JSON de resultados do TSE pode conter vários campos `nmabr` em níveis
diferentes. A versão inicial usava a primeira ocorrência, que pode representar
uma abrangência mais ampla e não o município. Esta versão só aceita como
município um valor que exista, para a mesma UF, na tabela oficial município →
DDD carregada da Anatel.
"""

from __future__ import annotations

import json
import urllib.error

import build_historical_ddd_2022 as base


def municipality_and_ddd(payload: object, uf: str, ddd_mapping: dict[tuple[str, str], str]) -> tuple[str, str]:
    uf_norm = base.normalize(uf)
    candidate_keys = {"nmabr", "nmmunicipio", "municipio", "nm_municipio"}
    seen: set[str] = set()

    for obj in base.walk(payload):
        if not isinstance(obj, dict):
            continue
        for key, value in obj.items():
            key_norm = base.normalize(key).lower().replace("_", "")
            if key_norm not in {item.replace("_", "") for item in candidate_keys}:
                continue
            if not isinstance(value, (str, int)):
                continue
            municipality = str(value).strip()
            municipality_norm = base.normalize(municipality)
            if not municipality_norm or municipality_norm in seen:
                continue
            seen.add(municipality_norm)
            ddd = ddd_mapping.get((uf_norm, municipality_norm), "")
            if ddd:
                return municipality, ddd

    return "", ""


def read_municipality_result_v2(
    uf: str,
    code: str,
    target_2022: set[str],
    ddd_mapping: dict[tuple[str, str], str],
) -> tuple[str, str, dict[str, int], int, int]:
    url = base.result_url(uf, code)
    try:
        payload = base.fetch_json(url, attempts=3, timeout=50)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return code, "", {}, 0, 404
        raise

    _, ddd = municipality_and_ddd(payload, uf, ddd_mapping)
    votes: dict[str, int] = {}
    for row in base.find_candidate_rows(payload):
        sqcand = str(base.row_value(row, "sqcand") or "").strip()
        if sqcand not in target_2022:
            continue
        votes[sqcand] = base.to_int(base.row_value(row, "vap"))

    return code, ddd, votes, sum(votes.values()), 200


def validate_nonempty_mapping() -> None:
    if not base.HISTORY_FILE.exists():
        raise RuntimeError("Mapa histórico não foi gerado")

    payload = json.loads(base.HISTORY_FILE.read_text(encoding="utf-8"))
    metadata = payload.get("metadata", {}) if isinstance(payload, dict) else {}
    diagnostics = metadata.get("diagnostics_by_uf", {}) if isinstance(metadata, dict) else {}
    records = payload.get("records", {}) if isinstance(payload, dict) else {}

    zero_mapped = []
    for uf, item in diagnostics.items() if isinstance(diagnostics, dict) else []:
        if not isinstance(item, dict):
            continue
        processed = int(item.get("municipios_processados") or 0)
        mapped = int(item.get("municipios_com_ddd") or 0)
        if processed > 0 and mapped == 0:
            zero_mapped.append(str(uf))

    if zero_mapped:
        raise RuntimeError(
            "Falha de qualidade: UFs processadas sem nenhum município associado a DDD: "
            + ", ".join(sorted(zero_mapped))
        )

    if not isinstance(records, dict) or not records:
        raise RuntimeError("Falha de qualidade: mapa histórico terminou sem nenhum registro com DDD")

    base.log(f"Validação v2: {len(records)} registros históricos com DDD; nenhuma UF processada ficou com mapeamento zero")


def main() -> int:
    base.read_municipality_result = read_municipality_result_v2
    result = base.main()
    validate_nonempty_mapping()
    return result


if __name__ == "__main__":
    raise SystemExit(main())
