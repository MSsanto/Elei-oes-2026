#!/usr/bin/env python3
"""Coleta cadastro e histórico de deputados na API oficial da Câmara.

O script usa somente a biblioteca padrão do Python e grava dados processados
em data/processed/camara/. Não faz qualquer avaliação política.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE_URL = "https://dadosabertos.camara.leg.br/api/v2"
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "processed" / "camara"
USER_AGENT = "Eleicoes-2026-Transparencia/0.2 (+https://github.com/MSsanto/Elei-oes-2026)"


def api_get(path: str, params: dict | None = None) -> dict:
    url = f"{BASE_URL}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def iter_pages(path: str, params: dict | None = None):
    query = dict(params or {})
    query.setdefault("itens", 100)
    query.setdefault("pagina", 1)

    while True:
        payload = api_get(path, query)
        items = payload.get("dados") or []
        for item in items:
            yield item

        links = payload.get("links") or []
        next_link = next((link for link in links if link.get("rel") == "next"), None)
        if not next_link or not items:
            break
        query["pagina"] += 1


def safe_data(payload: dict):
    data = payload.get("dados")
    if isinstance(data, list):
        return data[0] if data else {}
    return data or {}


def collect(limit: int | None = None, delay: float = 0.08) -> list[dict]:
    deputies = list(
        iter_pages(
            "/deputados",
            {"ordem": "ASC", "ordenarPor": "nome", "itens": 100},
        )
    )
    if limit:
        deputies = deputies[:limit]

    output: list[dict] = []
    total = len(deputies)

    for index, basic in enumerate(deputies, start=1):
        deputy_id = basic.get("id")
        if not deputy_id:
            continue

        print(f"Camara {index}/{total}: {basic.get('nome', deputy_id)}")
        detail = safe_data(api_get(f"/deputados/{deputy_id}"))
        time.sleep(delay)

        try:
            history_payload = api_get(f"/deputados/{deputy_id}/historico")
            history = history_payload.get("dados") or []
        except Exception as exc:  # preserva cadastro mesmo se um histórico falhar
            print(f"  aviso: historico indisponivel para {deputy_id}: {exc}")
            history = []
        time.sleep(delay)

        latest = detail.get("ultimoStatus") or {}
        output.append(
            {
                "camara_id_deputado": deputy_id,
                "nome": basic.get("nome") or latest.get("nome"),
                "nome_civil": detail.get("nomeCivil"),
                "sigla_partido": basic.get("siglaPartido") or latest.get("siglaPartido"),
                "sigla_uf": basic.get("siglaUf") or latest.get("siglaUf"),
                "url_foto": basic.get("urlFoto") or latest.get("urlFoto"),
                "email": basic.get("email") or latest.get("email"),
                "data_nascimento": detail.get("dataNascimento"),
                "municipio_nascimento": detail.get("municipioNascimento"),
                "uf_nascimento": detail.get("ufNascimento"),
                "escolaridade": detail.get("escolaridade"),
                "ultimo_status": latest,
                "historico": history,
                "fonte": "Camara dos Deputados - Dados Abertos",
                "fonte_url": f"{BASE_URL}/deputados/{deputy_id}",
            }
        )

    return output


def save(records: list[dict]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    collected_at = datetime.now(timezone.utc).isoformat()

    (OUT_DIR / "deputados.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    metadata = {
        "source": "Camara dos Deputados - Dados Abertos",
        "source_url": BASE_URL,
        "generated_at_utc": collected_at,
        "records": len(records),
        "domains": ["deputados", "historico_mandato"],
    }
    (OUT_DIR / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Camara: {len(records)} registros gravados em {OUT_DIR}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="limite para testes")
    parser.add_argument("--delay", type=float, default=0.08, help="pausa entre chamadas")
    args = parser.parse_args()
    save(collect(limit=args.limit, delay=args.delay))


if __name__ == "__main__":
    main()
