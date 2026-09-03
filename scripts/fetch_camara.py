#!/usr/bin/env python3
"""Coleta o catálogo oficial de todos os deputados que já exerceram mandato.

Fonte oficial: arquivo diário `deputados.json` dos Dados Abertos da Câmara.
A escolha do arquivo completo é intencional: o objetivo é descobrir quais
candidatos de 2026 já exerceram mandato, não apenas listar deputados atuais.
"""

from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCE_URL = "https://dadosabertos.camara.leg.br/arquivos/deputados/json/deputados.json"
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "processed" / "camara"
USER_AGENT = "Eleicoes-2026-Transparencia/0.3 (+https://github.com/MSsanto/Elei-oes-2026)"


def pick(record: dict, *names):
    for name in names:
        value = record.get(name)
        if value not in (None, ""):
            return value
    return None


def extract_id(record: dict):
    direct = pick(record, "id", "idDeputado", "ideCadastro", "codCadastro")
    if direct not in (None, ""):
        return direct
    uri = str(pick(record, "uri", "url") or "")
    match = re.search(r"/deputados/(\d+)", uri)
    return int(match.group(1)) if match else None


def unwrap(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("dados", "data", "deputados", "records"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
        # Alguns arquivos oficiais podem vir como objeto indexado.
        values = [value for value in payload.values() if isinstance(value, dict)]
        if values and all(extract_id(value) for value in values):
            return values
    raise RuntimeError("Formato inesperado no arquivo deputados.json da Câmara")


def download() -> list[dict]:
    request = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.load(response)
    return unwrap(payload)


def normalize_record(record: dict) -> dict:
    deputy_id = extract_id(record)
    return {
        "camara_id_deputado": deputy_id,
        "nome": pick(record, "nome", "nomeParlamentar", "nomeDeputado"),
        "nome_civil": pick(record, "nomeCivil", "nome_civil"),
        "data_nascimento": pick(record, "dataNascimento", "data_nascimento"),
        "municipio_nascimento": pick(record, "municipioNascimento", "municipio_nascimento"),
        "uf_nascimento": pick(record, "ufNascimento", "uf_nascimento"),
        "primeira_legislatura": pick(
            record,
            "idLegislaturaInicial",
            "legislaturaInicial",
            "primeiraLegislatura",
        ),
        "ultima_legislatura": pick(
            record,
            "idLegislaturaFinal",
            "legislaturaFinal",
            "ultimaLegislatura",
        ),
        "uri": pick(record, "uri", "url") or (
            f"https://dadosabertos.camara.leg.br/api/v2/deputados/{deputy_id}"
            if deputy_id else None
        ),
        "fonte": "Câmara dos Deputados — Dados Abertos",
        "fonte_url": SOURCE_URL,
    }


def main() -> None:
    print("Baixando catálogo histórico de deputados da Câmara...")
    raw_records = download()
    records = [normalize_record(item) for item in raw_records if isinstance(item, dict)]
    records = [item for item in records if item["camara_id_deputado"]]

    if len(records) < 500:
        raise SystemExit(
            f"Carga da Câmara recusada por segurança: somente {len(records)} registros."
        )

    # IDs da Câmara são universais; duplicatas no arquivo não devem chegar ao site.
    by_id = {str(item["camara_id_deputado"]): item for item in records}
    clean = sorted(
        by_id.values(),
        key=lambda item: str(item.get("nome_civil") or item.get("nome") or ""),
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "deputados.json").write_text(
        json.dumps(clean, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    metadata = {
        "source": "Câmara dos Deputados — Dados Abertos",
        "source_url": SOURCE_URL,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "records": len(clean),
        "scope": "todos os parlamentares que já estiveram em exercício na Câmara",
    }
    (OUT_DIR / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Câmara: {len(clean)} parlamentares históricos catalogados.")


if __name__ == "__main__":
    main()
