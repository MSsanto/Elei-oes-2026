#!/usr/bin/env python3
"""Constrói vínculo auditável entre registros do TSE e da Câmara.

Regras conservadoras:
- nunca confirma somente por nome;
- nome civil + UF é apenas revisão manual;
- nome civil + UF + data de nascimento coincidente pode ser confirmado;
- múltiplos candidatos possíveis permanecem em revisão.
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
TSE_FILE = ROOT / "data" / "processed" / "deputados_federais.json"
CAMARA_FILE = ROOT / "data" / "processed" / "camara" / "deputados.json"
OUT_FILE = ROOT / "data" / "processed" / "mappings" / "identidades.json"


def normalize(value) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^A-Za-z0-9 ]+", " ", text).upper()
    return " ".join(text.split())


def normalize_date(value) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    parts = re.split(r"[-/T ]", text)
    nums = [p for p in parts if p.isdigit()]
    if len(nums) >= 3:
        if len(nums[0]) == 4:
            return f"{nums[0]}-{nums[1].zfill(2)}-{nums[2].zfill(2)}"
        return f"{nums[2]}-{nums[1].zfill(2)}-{nums[0].zfill(2)}"
    return text


def load_json(path: Path):
    if not path.exists():
        raise SystemExit(f"Arquivo ausente: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    tse = load_json(TSE_FILE)
    camara = load_json(CAMARA_FILE)

    chamber_index: dict[tuple[str, str], list[dict]] = {}
    for dep in camara:
        name = normalize(dep.get("nome_civil") or dep.get("nome"))
        uf = normalize(dep.get("sigla_uf"))
        if not name:
            continue
        chamber_index.setdefault((name, uf), []).append(dep)

    output = []
    for cand in tse:
        name = normalize(cand.get("nome"))
        uf = normalize(cand.get("uf"))
        candidates = chamber_index.get((name, uf), [])

        status = "nao_encontrada"
        camara_ids = []
        evidence = []

        if len(candidates) == 1:
            dep = candidates[0]
            camara_ids = [dep.get("camara_id_deputado")]
            evidence = ["nome_civil_normalizado", "uf"]
            tse_birth = normalize_date(cand.get("data_nascimento"))
            camara_birth = normalize_date(dep.get("data_nascimento"))
            if tse_birth and camara_birth and tse_birth == camara_birth:
                status = "confirmada"
                evidence.append("data_nascimento")
            else:
                status = "revisao_manual"
        elif len(candidates) > 1:
            status = "revisao_manual"
            camara_ids = [dep.get("camara_id_deputado") for dep in candidates]
            evidence = ["nome_civil_normalizado", "uf", "multiplos_registros_possiveis"]

        output.append(
            {
                "politico_id": f"tse-{cand.get('id_tse')}",
                "tse_sq_candidato": [str(cand.get("id_tse"))] if cand.get("id_tse") else [],
                "camara_id_deputado": [item for item in camara_ids if item is not None],
                "nome_civil": cand.get("nome"),
                "data_nascimento": cand.get("data_nascimento"),
                "uf": cand.get("uf"),
                "correspondencia_status": status,
                "evidencias_correspondencia": evidence,
            }
        )

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": "nome_civil+uf; confirma somente quando data_nascimento também coincide",
        "records": output,
    }
    OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    counts = {}
    for item in output:
        counts[item["correspondencia_status"]] = counts.get(item["correspondencia_status"], 0) + 1
    print("Identidades:", counts)


if __name__ == "__main__":
    main()
