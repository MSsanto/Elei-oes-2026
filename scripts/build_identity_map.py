#!/usr/bin/env python3
"""Constrói vínculo auditável entre candidatos do TSE e o catálogo da Câmara.

Política de correspondência conservadora:
- nunca confirma apenas por nome;
- nome civil + data de nascimento exatos e únicos podem ser confirmados;
- nome coincidente sem nascimento fica em revisão manual;
- múltiplos registros possíveis nunca são confirmados automaticamente.
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

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

    # aceita DD/MM/AAAA, AAAA-MM-DD e timestamps ISO
    date_part = text.split("T", 1)[0].strip()
    if re.fullmatch(r"\d{4}-\d{1,2}-\d{1,2}", date_part):
        year, month, day = date_part.split("-")
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}", date_part):
        day, month, year = date_part.split("/")
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return date_part


def load_json(path: Path):
    if not path.exists():
        raise SystemExit(f"Arquivo ausente: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    tse = load_json(TSE_FILE)
    camara = load_json(CAMARA_FILE)

    exact_index: dict[tuple[str, str], list[dict]] = {}
    name_index: dict[str, list[dict]] = {}

    for dep in camara:
        name = normalize(dep.get("nome_civil") or dep.get("nome"))
        birth = normalize_date(dep.get("data_nascimento"))
        if not name:
            continue
        name_index.setdefault(name, []).append(dep)
        if birth:
            exact_index.setdefault((name, birth), []).append(dep)

    output = []
    for cand in tse:
        name = normalize(cand.get("nome"))
        birth = normalize_date(cand.get("data_nascimento"))
        exact = exact_index.get((name, birth), []) if name and birth else []
        same_name = name_index.get(name, []) if name else []

        status = "nao_encontrada"
        matches: list[dict] = []
        evidence: list[str] = []

        if len(exact) == 1:
            status = "confirmada"
            matches = exact
            evidence = ["nome_civil_normalizado", "data_nascimento"]
        elif len(exact) > 1:
            status = "revisao_manual"
            matches = exact
            evidence = [
                "nome_civil_normalizado",
                "data_nascimento",
                "multiplos_registros_exatos",
            ]
        elif same_name:
            status = "revisao_manual"
            matches = same_name
            evidence = ["nome_civil_normalizado", "nascimento_nao_confirmado"]
            if len(same_name) > 1:
                evidence.append("multiplos_registros_possiveis")

        primary = matches[0] if status == "confirmada" and len(matches) == 1 else None
        camara_ids = [
            item.get("camara_id_deputado")
            for item in matches
            if item.get("camara_id_deputado") is not None
        ]

        output.append(
            {
                "politico_id": f"tse-{cand.get('id_tse')}",
                "tse_sq_candidato": [str(cand.get("id_tse"))] if cand.get("id_tse") else [],
                "camara_id_deputado": camara_ids,
                "nome_civil": cand.get("nome"),
                "data_nascimento": cand.get("data_nascimento"),
                "uf_candidatura_2026": cand.get("uf"),
                "correspondencia_status": status,
                "evidencias_correspondencia": evidence,
                "historico_camara_localizado": status == "confirmada",
                "camara": (
                    {
                        "nome_parlamentar": primary.get("nome"),
                        "nome_civil": primary.get("nome_civil"),
                        "primeira_legislatura": primary.get("primeira_legislatura"),
                        "ultima_legislatura": primary.get("ultima_legislatura"),
                        "uri": primary.get("uri"),
                    }
                    if primary
                    else None
                ),
            }
        )

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    for item in output:
        status = item["correspondencia_status"]
        counts[status] = counts.get(status, 0) + 1

    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": "confirma somente nome civil normalizado + data de nascimento exatos e únicos",
        "counts": counts,
        "records": output,
    }
    OUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Console do Windows PowerShell 5.1 pode usar cp1252. Mantenha stdout ASCII
    # para não abortar uma coleta válida por causa de caracteres Unicode de UI.
    print("Identidades TSE <-> Camara:", json.dumps(counts, ensure_ascii=True))


if __name__ == "__main__":
    main()
