#!/usr/bin/env python3
"""Coleta histórico de exercício apenas para vínculos TSE↔Câmara confirmados.

A execução é incremental e usa cache por horas para não repetir centenas de
requisições em cada rodada de atualização do TSE.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE_URL = "https://dadosabertos.camara.leg.br/api/v2"
ROOT = Path(__file__).resolve().parents[1]
MAP_FILE = ROOT / "data" / "processed" / "mappings" / "identidades.json"
OUT_FILE = ROOT / "data" / "processed" / "camara" / "historico_confirmados.json"
USER_AGENT = "Eleicoes-2026-Transparencia/0.3 (+https://github.com/MSsanto/Elei-oes-2026)"


def get_json(url: str):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def should_refresh(path: Path, max_age_hours: int) -> bool:
    if not path.exists():
        return True
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        stamp = payload.get("generated_at_utc")
        if not stamp:
            return True
        generated = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) - generated >= timedelta(hours=max_age_hours)
    except Exception:
        return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-age-hours", type=int, default=12)
    parser.add_argument("--delay", type=float, default=0.08)
    args = parser.parse_args()

    if not MAP_FILE.exists():
        raise SystemExit(f"Mapa de identidades ausente: {MAP_FILE}")

    if not should_refresh(OUT_FILE, args.max_age_hours):
        print(f"Historico da Camara ainda dentro do cache de {args.max_age_hours}h; coleta ignorada.")
        return

    mapping = json.loads(MAP_FILE.read_text(encoding="utf-8"))
    records = mapping.get("records") or []
    ids = sorted(
        {
            str(item["camara_id_deputado"][0])
            for item in records
            if item.get("correspondencia_status") == "confirmada"
            and len(item.get("camara_id_deputado") or []) == 1
        }
    )

    output = {}
    errors = []
    total = len(ids)
    for index, deputy_id in enumerate(ids, start=1):
        print(f"Historico Camara {index}/{total}: {deputy_id}")
        try:
            detail_payload = get_json(f"{BASE_URL}/deputados/{deputy_id}")
            history_payload = get_json(f"{BASE_URL}/deputados/{deputy_id}/historico")
            output[deputy_id] = {
                "detalhe": detail_payload.get("dados"),
                "historico": history_payload.get("dados") or [],
                "fonte_detalhe": f"{BASE_URL}/deputados/{deputy_id}",
                "fonte_historico": f"{BASE_URL}/deputados/{deputy_id}/historico",
            }
        except Exception as exc:
            errors.append({"camara_id_deputado": deputy_id, "erro": str(exc)})
        time.sleep(args.delay)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "Câmara dos Deputados — Dados Abertos",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "records": len(output),
        "errors": errors,
        "deputados": output,
    }
    OUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Historico Camara: {len(output)} perfis coletados; {len(errors)} falhas.")


if __name__ == "__main__":
    main()
