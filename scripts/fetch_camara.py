#!/usr/bin/env python3
"""Coleta o catálogo oficial de todos os deputados que já exerceram mandato.

Fonte oficial: arquivo diário `deputados.json` dos Dados Abertos da Câmara.
A escolha do arquivo completo é intencional: o objetivo é descobrir quais
candidatos de 2026 já exerceram mandato, não apenas listar deputados atuais.
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCE_URL = "https://dadosabertos.camara.leg.br/arquivos/deputados/json/deputados.json"
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "processed" / "camara"
DATA_PATH = OUT_DIR / "deputados.json"
META_PATH = OUT_DIR / "metadata.json"
USER_AGENT = "Eleicoes-2026-Transparencia/0.3 (+https://github.com/MSsanto/Elei-oes-2026)"
MIN_RECORDS = 500


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
        values = [value for value in payload.values() if isinstance(value, dict)]
        if values and all(extract_id(value) for value in values):
            return values
    raise RuntimeError("Formato inesperado no arquivo deputados.json da Câmara")


def load_cached_records() -> list[dict] | None:
    try:
        payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, list) or len(payload) < MIN_RECORDS:
        return None
    return [item for item in payload if isinstance(item, dict)]


def cache_age_hours() -> float | None:
    if not META_PATH.exists() or not DATA_PATH.exists():
        return None
    try:
        metadata = json.loads(META_PATH.read_text(encoding="utf-8"))
        generated = datetime.fromisoformat(str(metadata["generated_at_utc"]).replace("Z", "+00:00"))
        if generated.tzinfo is None:
            generated = generated.replace(tzinfo=timezone.utc)
        return max(0.0, (datetime.now(timezone.utc) - generated).total_seconds() / 3600)
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None


def cache_is_fresh(max_age_hours: float) -> bool:
    records = load_cached_records()
    age = cache_age_hours()
    return bool(records is not None and age is not None and age <= max_age_hours)


def download(attempts: int = 3, timeout: int = 75) -> list[dict]:
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        request = urllib.request.Request(
            SOURCE_URL,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        try:
            print(f"Câmara: download do catálogo (tentativa {attempt}/{attempts})...", flush=True)
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = json.load(response)
            return unwrap(payload)
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
            last_error = error
            if attempt < attempts:
                wait = attempt * 3
                print(f"Câmara: falha temporária ({error}); nova tentativa em {wait}s.", flush=True)
                time.sleep(wait)

    raise RuntimeError(f"Falha ao baixar catálogo da Câmara após {attempts} tentativas: {last_error}")


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--max-age-hours",
        type=float,
        default=24,
        help="Reutiliza o catálogo já publicado enquanto ele for mais novo que este limite.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if cache_is_fresh(args.max_age_hours):
        age = cache_age_hours() or 0
        records = load_cached_records() or []
        print(
            f"Câmara: catálogo em cache ainda válido ({len(records)} registros, {age:.1f}h de idade); download dispensado."
        )
        return

    print("Baixando catálogo histórico de deputados da Câmara...")
    try:
        raw_records = download()
    except Exception as error:
        cached = load_cached_records()
        if cached:
            print(
                f"AVISO: Câmara indisponível ({error}). Mantendo catálogo anterior válido com {len(cached)} registros."
            )
            return
        raise

    records = [normalize_record(item) for item in raw_records if isinstance(item, dict)]
    records = [item for item in records if item["camara_id_deputado"]]

    if len(records) < MIN_RECORDS:
        raise SystemExit(
            f"Carga da Câmara recusada por segurança: somente {len(records)} registros."
        )

    by_id = {str(item["camara_id_deputado"]): item for item in records}
    clean = sorted(
        by_id.values(),
        key=lambda item: str(item.get("nome_civil") or item.get("nome") or ""),
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(
        json.dumps(clean, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    metadata = {
        "source": "Câmara dos Deputados — Dados Abertos",
        "source_url": SOURCE_URL,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "records": len(clean),
        "scope": "todos os parlamentares que já estiveram em exercício na Câmara",
    }
    META_PATH.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Câmara: {len(clean)} parlamentares históricos catalogados.")


if __name__ == "__main__":
    main()
