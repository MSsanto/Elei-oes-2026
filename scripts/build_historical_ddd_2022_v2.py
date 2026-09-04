#!/usr/bin/env python3
"""Correção territorial para a regionalização histórica por DDD.

Os arquivos municipais de votação do TSE 2022 identificam a abrangência por
código (`tpabr=MU`, `cdabr=xxxxx`), mas não carregam o nome do município. O
catálogo global oficial do próprio TSE (`mun-e000546-cm.json`) contém a relação
entre UF, código municipal e nome. Esta camada cruza:

    código municipal do resultado TSE
        -> nome do município no catálogo TSE
        -> Código Nacional (DDD) na tabela oficial da Anatel

Assim, não inferimos município a partir de texto do arquivo de votação.
"""

from __future__ import annotations

import json
import re
import urllib.error

import build_historical_ddd_2022 as base


_CODE_TO_DDD: dict[tuple[str, str], str] = {}
_CODE_TO_NAME: dict[tuple[str, str], str] = {}
_ORIGINAL_LOAD_DDD = base.load_ddd_mapping


def build_tse_code_mapping(
    ddd_mapping: dict[tuple[str, str], str],
) -> tuple[dict[tuple[str, str], str], dict[tuple[str, str], str]]:
    """Monta (UF, código TSE de 5 dígitos) -> DDD/nome usando fontes oficiais."""

    payload = base.fetch_json(base.GLOBAL_MUNICIPALITIES_URL)
    code_to_ddd: dict[tuple[str, str], str] = {}
    code_to_name: dict[tuple[str, str], str] = {}

    def visit(value: object, inherited_uf: str = "") -> None:
        if isinstance(value, list):
            for child in value:
                visit(child, inherited_uf)
            return
        if not isinstance(value, dict):
            return

        local_uf = inherited_uf
        raw_cd = str(value.get("cd") or "").strip()
        normalized_cd = base.normalize(raw_cd)

        # No catálogo do TSE o objeto-pai da UF usa, por exemplo, cd="AC".
        if re.fullmatch(r"[A-Z]{2}", normalized_cd):
            local_uf = normalized_cd
        else:
            # Fallback conservador para eventuais variantes do catálogo.
            for key in ("uf", "sg", "sguf", "sg_uf"):
                candidate = base.normalize(value.get(key))
                if re.fullmatch(r"[A-Z]{2}", candidate):
                    local_uf = candidate
                    break

        code_digits = re.sub(r"\D", "", raw_cd)
        municipality = str(value.get("nm") or "").strip()
        if local_uf and len(code_digits) == 5 and municipality:
            municipality_norm = base.normalize(municipality)
            ddd = ddd_mapping.get((local_uf, municipality_norm), "")
            if ddd:
                key = (local_uf, code_digits)
                previous = code_to_ddd.get(key)
                if previous and previous != ddd:
                    raise RuntimeError(
                        f"Conflito territorial para {local_uf}/{code_digits}: DDD {previous} x {ddd}"
                    )
                code_to_ddd[key] = ddd
                code_to_name[key] = municipality

        for child in value.values():
            if isinstance(child, (dict, list)):
                visit(child, local_uf)

    visit(payload)

    if len(code_to_ddd) < 5000:
        raise RuntimeError(
            "Falha de qualidade: catálogo TSE + tabela Anatel produziram somente "
            f"{len(code_to_ddd)} códigos municipais com DDD"
        )

    base.log(
        f"TSE + Anatel: {len(code_to_ddd)} códigos municipais oficiais associados a DDD"
    )
    return code_to_ddd, code_to_name


def load_ddd_mapping_v2() -> tuple[dict[tuple[str, str], str], str]:
    mapping, source = _ORIGINAL_LOAD_DDD()
    global _CODE_TO_DDD, _CODE_TO_NAME
    _CODE_TO_DDD, _CODE_TO_NAME = build_tse_code_mapping(mapping)
    return mapping, source


def read_municipality_result_v2(
    uf: str,
    code: str,
    target_2022: set[str],
    ddd_mapping: dict[tuple[str, str], str],
) -> tuple[str, str, dict[str, int], int, int]:
    del ddd_mapping  # a associação já foi validada e materializada por código.

    uf_norm = base.normalize(uf)
    code_digits = re.sub(r"\D", "", str(code or ""))
    ddd = _CODE_TO_DDD.get((uf_norm, code_digits), "")

    url = base.result_url(uf, code_digits)
    try:
        payload = base.fetch_json(url, attempts=3, timeout=50)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return code_digits, ddd, {}, 0, 404
        raise

    # Confere que o arquivo realmente declara a mesma abrangência municipal.
    declared_codes: set[str] = set()
    for obj in base.walk(payload):
        if not isinstance(obj, dict):
            continue
        if base.normalize(obj.get("tpabr")) != "MU":
            continue
        declared = re.sub(r"\D", "", str(obj.get("cdabr") or ""))
        if len(declared) == 5:
            declared_codes.add(declared)
    if declared_codes and code_digits not in declared_codes:
        raise RuntimeError(
            f"{uf_norm}/{code_digits}: arquivo TSE declarou abrangência municipal {sorted(declared_codes)}"
        )

    votes: dict[str, int] = {}
    for row in base.find_candidate_rows(payload):
        sqcand = str(base.row_value(row, "sqcand") or "").strip()
        if sqcand not in target_2022:
            continue
        votes[sqcand] = base.to_int(base.row_value(row, "vap"))

    return code_digits, ddd, votes, sum(votes.values()), 200


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

    base.log(
        f"Validação territorial: {len(records)} registros históricos com DDD; "
        "nenhuma UF processada ficou com mapeamento zero"
    )


def main() -> int:
    base.load_ddd_mapping = load_ddd_mapping_v2
    base.read_municipality_result = read_municipality_result_v2
    result = base.main()
    validate_nonempty_mapping()
    return result


if __name__ == "__main__":
    raise SystemExit(main())
