#!/usr/bin/env python3
"""Diagnóstico curto da estrutura territorial dos Resultados TSE 2022.

Não consulta dados pessoais. Lê apenas arquivos públicos de configuração do TSE
e um arquivo municipal de votação, imprimindo chaves e pequenos valores
territoriais para localizar a relação código municipal -> nome.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import build_historical_ddd_2022 as base


def compact_objects(payload: object, limit: int = 25) -> list[dict]:
    out: list[dict] = []
    interesting = ("mun", "abr", "local", "uf", "nome", "nm", "codigo", "cd")
    for obj in base.walk(payload):
        if not isinstance(obj, dict):
            continue
        selected = {}
        for key, value in obj.items():
            key_norm = base.normalize(key).lower()
            if not any(token in key_norm for token in interesting):
                continue
            if isinstance(value, (str, int, float, bool)) or value is None:
                text = str(value)
                if len(text) <= 100:
                    selected[key] = value
        if selected:
            out.append(selected)
        if len(out) >= limit:
            break
    return out


def main() -> int:
    uf = "AC"
    uf_lower = uf.lower()
    index_url = f"{base.RESULTS_BASE}/config/{uf_lower}/{uf_lower}-e{base.ELECTION_FILE_CODE}-i.json"
    print("=== INDEX AC ===")
    index = base.fetch_json(index_url)
    print("top_type:", type(index).__name__)
    if isinstance(index, dict):
        print("top_keys:", sorted(index.keys()))
    print("objects:", json.dumps(compact_objects(index), ensure_ascii=False, indent=2))

    print("=== GLOBAL MUNICIPIOS ===")
    global_payload = base.fetch_json(base.GLOBAL_MUNICIPALITIES_URL)
    print("top_type:", type(global_payload).__name__)
    if isinstance(global_payload, dict):
        print("top_keys:", sorted(global_payload.keys()))
    ac_objects = []
    for obj in base.walk(global_payload):
        if not isinstance(obj, dict):
            continue
        serialized = " ".join(base.normalize(v) for v in obj.values() if isinstance(v, (str, int)))
        if "AC" not in serialized:
            continue
        ac_objects.extend(compact_objects(obj, limit=5))
        if len(ac_objects) >= 10:
            break
    print("ac_objects:", json.dumps(ac_objects[:10], ensure_ascii=False, indent=2))

    codes = base.municipality_codes_for_uf(uf)
    if not codes:
        raise RuntimeError("Nenhum código municipal encontrado para AC")
    code = codes[0]
    url = base.result_url(uf, code)
    print("=== RESULTADO MUNICIPAL ===")
    print("code:", code)
    print("url:", url)
    result = base.fetch_json(url)
    print("top_type:", type(result).__name__)
    if isinstance(result, dict):
        print("top_keys:", sorted(result.keys()))
    print("objects:", json.dumps(compact_objects(result, limit=30), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
