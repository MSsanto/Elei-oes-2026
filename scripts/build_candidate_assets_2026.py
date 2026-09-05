from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import tempfile
import unicodedata
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "data" / "processed" / "patrimonio-2026"
CURRENT_CANDIDATES_DIR = ROOT / "data" / "processed" / "candidatos"
FEDERAL_CANDIDATES = ROOT / "data" / "processed" / "deputados_federais.json"
SOURCE_URL_2026 = "https://dadosabertos.tse.jus.br/dataset/candidatos-2026"
SOURCE_URL_2022 = "https://dadosabertos.tse.jus.br/dataset/candidatos-2022"
SHARD_COUNT = 256

ADDRESS_TOKENS = re.compile(
    r"\b(RUA|R\.|AVENIDA|AV\.|ALAMEDA|TRAVESSA|ESTRADA|RODOVIA|QUADRA|LOTE|"
    r"LOTEAMENTO|CONDOM[IÍ]NIO|APARTAMENTO|APTO|BLOCO|N[ÚU]MERO|Nº|N°)\b",
    re.I,
)
BANK_TOKENS = re.compile(r"\b(AG[EÊ]NCIA|CONTA(?:\s+CORRENTE)?|BANCO|PIX)\b", re.I)
SENSITIVE_PATTERNS = [
    re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"),
    re.compile(r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b"),
    re.compile(r"\b\d{5}-?\d{3}\b"),
    re.compile(r"\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}\b"),
    re.compile(r"\b[A-Z]{3}[-\s]?\d[A-Z0-9]\d{2}\b", re.I),
    re.compile(r"\bRENAVAM\s*[:#-]?\s*\d+\b", re.I),
    re.compile(r"\bMATR[IÍ]CULA\s*[:#-]?\s*[A-Z0-9./-]+\b", re.I),
    re.compile(r"\b(?:AG(?:ÊNCIA)?|CONTA)\s*[:#-]?\s*[A-Z0-9./-]+\b", re.I),
    re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"),
    re.compile(r"https?://\S+", re.I),
]


def text(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def normalize(value: object) -> str:
    raw = unicodedata.normalize("NFKD", str(value or ""))
    raw = "".join(ch for ch in raw if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", raw).strip().upper()


def normalize_date(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    match = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", raw)
    if match:
        return raw
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})", raw)
    if match:
        year, month, day = match.groups()
        return f"{day}/{month}/{year}"
    return raw


def identity_signature(name: object, birth_date: object, gender: object) -> str:
    parts = (normalize(name), normalize_date(birth_date), normalize(gender))
    return "|".join(parts) if all(parts) else ""


def money_value(value: object) -> Decimal:
    raw = str(value or "").strip().replace("R$", "").replace(" ", "")
    if not raw:
        return Decimal("0")
    if "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    try:
        return Decimal(raw)
    except InvalidOperation:
        return Decimal("0")


def number(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01")))


def shard_key(candidate_id: str) -> str:
    try:
        value = int(str(candidate_id).strip())
    except ValueError:
        value = sum(ord(char) for char in str(candidate_id))
    return f"{value % SHARD_COUNT:02x}"


def sanitize_description(value: object) -> tuple[str, bool]:
    raw = re.sub(r"\s+", " ", str(value or "").strip())
    if not raw:
        return "Descrição não informada na fonte.", False
    if ADDRESS_TOKENS.search(raw):
        return "Descrição detalhada omitida para reduzir exposição de endereço.", True
    if BANK_TOKENS.search(raw) and re.search(r"\d", raw):
        return "Descrição detalhada omitida para reduzir exposição de dados financeiros.", True

    sanitized = raw
    changed = False
    for pattern in SENSITIVE_PATTERNS:
        next_value = pattern.sub("[dado identificador omitido]", sanitized)
        changed = changed or next_value != sanitized
        sanitized = next_value

    next_value = re.sub(r"\b\d{7,}\b", "[identificador omitido]", sanitized)
    changed = changed or next_value != sanitized
    sanitized = next_value.strip(" ;,.-")
    if not sanitized:
        return "Descrição detalhada omitida por privacidade.", True
    if len(sanitized) > 220:
        sanitized = sanitized[:217].rstrip() + "…"
        changed = True
    return sanitized, changed


def read_csv(path: Path):
    last_error = None
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            with path.open("r", encoding=encoding, newline="") as handle:
                yield from csv.DictReader(handle, delimiter=";")
            return
        except UnicodeDecodeError as error:
            last_error = error
    if last_error:
        with path.open("r", encoding="latin-1", errors="replace", newline="") as handle:
            yield from csv.DictReader(handle, delimiter=";")


def find_files(base: Path, pattern: str) -> list[Path]:
    rx = re.compile(pattern, re.I)
    files = sorted(path for path in base.rglob("*.csv") if rx.search(path.name))
    national = [path for path in files if "_BRASIL" in path.name.upper()]
    return national or files


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def collect_current_identities() -> tuple[dict[str, str], dict[str, list[str]]]:
    by_id: dict[str, str] = {}
    by_signature: dict[str, list[str]] = defaultdict(list)

    def add_record(item: object) -> None:
        if not isinstance(item, dict):
            return
        candidate_id = str(item.get("id_tse") or item.get("SQ_CANDIDATO") or "").strip()
        if not candidate_id or candidate_id in by_id:
            return
        signature = identity_signature(
            item.get("nome") or item.get("NM_CANDIDATO"),
            item.get("data_nascimento") or item.get("DT_NASCIMENTO"),
            item.get("genero") or item.get("DS_GENERO"),
        )
        if not signature:
            return
        by_id[candidate_id] = signature
        by_signature[signature].append(candidate_id)

    if FEDERAL_CANDIDATES.exists():
        payload = load_json(FEDERAL_CANDIDATES)
        if isinstance(payload, list):
            for item in payload:
                add_record(item)

    if CURRENT_CANDIDATES_DIR.exists():
        for path in CURRENT_CANDIDATES_DIR.rglob("*.json"):
            if path.name == "manifest.json":
                continue
            payload = load_json(path)
            if isinstance(payload, list):
                for item in payload:
                    add_record(item)
            elif isinstance(payload, dict):
                if payload.get("id_tse") or payload.get("SQ_CANDIDATO"):
                    add_record(payload)
                for key in ("records", "candidatos", "items"):
                    if isinstance(payload.get(key), list):
                        for item in payload[key]:
                            add_record(item)

    return by_id, by_signature


def collect_historical_candidates(source_dir: Path) -> dict[str, list[str]]:
    by_signature: dict[str, list[str]] = defaultdict(list)
    seen_ids: set[str] = set()
    files = find_files(source_dir, r"consulta_cand_2022.*\.csv$")
    for path in files:
        for row in read_csv(path):
            candidate_id = text(row, "SQ_CANDIDATO")
            signature = identity_signature(
                text(row, "NM_CANDIDATO"),
                text(row, "DT_NASCIMENTO"),
                text(row, "DS_GENERO"),
            )
            if not candidate_id or not signature or candidate_id in seen_ids:
                continue
            seen_ids.add(candidate_id)
            by_signature[signature].append(candidate_id)
    return by_signature


def collect_asset_totals(source_dir: Path, year: int) -> tuple[dict[str, Decimal], int]:
    totals: dict[str, Decimal] = defaultdict(Decimal)
    rows = 0
    files = find_files(source_dir, rf"bem_candidato_{year}.*\.csv$")
    for path in files:
        for row in read_csv(path):
            candidate_id = text(row, "SQ_CANDIDATO")
            value = money_value(text(row, "VR_BEM_CANDIDATO", "VR_BEM"))
            if not candidate_id:
                continue
            rows += 1
            if value >= 0:
                totals[candidate_id] += value
    return totals, rows


def publish(payloads: dict[str, dict], manifest: dict) -> None:
    parent = OUTPUT_DIR.parent
    parent.mkdir(parents=True, exist_ok=True)
    staging = parent / ".patrimonio-2026.staging"
    backup = parent / ".patrimonio-2026.backup"
    shutil.rmtree(staging, ignore_errors=True)
    shutil.rmtree(backup, ignore_errors=True)
    shards_dir = staging / "shards"
    shards_dir.mkdir(parents=True, exist_ok=True)

    shards: dict[str, dict[str, dict]] = defaultdict(dict)
    for candidate_id, payload in payloads.items():
        shards[shard_key(candidate_id)][candidate_id] = payload

    for key, records in sorted(shards.items()):
        (shards_dir / f"{key}.json").write_text(
            json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )

    manifest["shard_strategy"] = "SQ_CANDIDATO modulo 256 em hexadecimal"
    manifest["shard_count"] = len(shards)
    manifest["shard_slots"] = SHARD_COUNT
    (staging / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    if OUTPUT_DIR.exists():
        OUTPUT_DIR.rename(backup)
    try:
        staging.rename(OUTPUT_DIR)
    except Exception:
        if backup.exists() and not OUTPUT_DIR.exists():
            backup.rename(OUTPUT_DIR)
        raise
    shutil.rmtree(backup, ignore_errors=True)


def process(current_assets: Path, historical_candidates: Path | None = None, historical_assets: Path | None = None) -> dict:
    current_files = find_files(current_assets, r"bem_candidato_2026.*\.csv$")
    if not current_files:
        raise RuntimeError("Nenhum CSV de bens de candidatos de 2026 foi localizado.")

    data: dict[str, dict] = defaultdict(lambda: {
        "total": Decimal("0"), "by_type": defaultdict(Decimal), "assets": []
    })
    raw_rows = 0
    redacted_rows = 0

    for path in current_files:
        for row in read_csv(path):
            candidate_id = text(row, "SQ_CANDIDATO")
            if not candidate_id:
                continue
            category = text(row, "DS_TIPO_BEM_CANDIDATO", "DS_TIPO_BEM", "CD_TIPO_BEM_CANDIDATO") or "Tipo não informado"
            description, redacted = sanitize_description(text(row, "DS_BEM_CANDIDATO", "DS_BEM"))
            value = money_value(text(row, "VR_BEM_CANDIDATO", "VR_BEM"))
            item = data[candidate_id]
            item["total"] += value
            item["by_type"][category] += value
            item["assets"].append({
                "categoria": category,
                "descricao": description,
                "valor": number(value),
                "descricao_reduzida": redacted,
            })
            raw_rows += 1
            redacted_rows += int(redacted)

    current_identity_by_id, current_by_signature = collect_current_identities()
    historical_totals: dict[str, Decimal] = {}
    historical_candidate_by_signature: dict[str, list[str]] = {}
    history_rows = 0
    if historical_candidates and historical_assets:
        historical_candidate_by_signature = collect_historical_candidates(historical_candidates)
        historical_totals, history_rows = collect_asset_totals(historical_assets, 2022)

    generated = datetime.now(timezone.utc).isoformat()
    matched_history = 0
    payloads: dict[str, dict] = {}

    for candidate_id, item in data.items():
        categories = [
            {"categoria": category, "valor": number(value)}
            for category, value in sorted(item["by_type"].items(), key=lambda pair: normalize(pair[0]))
        ]
        assets = sorted(
            item["assets"],
            key=lambda asset: (normalize(asset["categoria"]), normalize(asset["descricao"]), asset["valor"]),
        )
        history = []
        signature = current_identity_by_id.get(candidate_id, "")
        if signature and len(current_by_signature.get(signature, [])) == 1:
            past_ids = historical_candidate_by_signature.get(signature, [])
            if len(past_ids) == 1 and past_ids[0] in historical_totals:
                history.append({
                    "ano": 2022,
                    "total_declarado": number(historical_totals[past_ids[0]]),
                    "vinculo": "nome + data de nascimento + gênero; assinatura exata e única",
                })
                matched_history += 1
        history.append({"ano": 2026, "total_declarado": number(item["total"]), "vinculo": "registro atual"})

        payloads[candidate_id] = {
            "schema_version": 1,
            "id_tse": candidate_id,
            "source": "TSE — Bens de candidatos 2026",
            "source_url": SOURCE_URL_2026,
            "generated_at_utc": generated,
            "resumo": {"total_declarado": number(item["total"]), "quantidade_bens": len(assets)},
            "bens_por_tipo": categories,
            "bens": assets,
            "historico": history,
            "historico_metodo": "2022 somente quando nome civil, data de nascimento e gênero formam assinatura exata e única nas duas eleições.",
            "privacidade": "Descrições são reduzidas quando contêm padrões de endereço, dados financeiros ou identificadores pessoais.",
        }

    manifest = {
        "schema_version": 1,
        "source": "TSE — Candidatos 2026 / Bens de candidatos",
        "source_url": SOURCE_URL_2026,
        "historical_source": "TSE — Candidatos 2022 / Bens de candidatos" if historical_candidates and historical_assets else None,
        "historical_source_url": SOURCE_URL_2022 if historical_candidates and historical_assets else None,
        "generated_at_utc": generated,
        "candidates": len(payloads),
        "asset_rows": raw_rows,
        "asset_rows_with_reduced_description": redacted_rows,
        "historical_asset_rows": history_rows,
        "historical_matches": matched_history,
        "privacy_method": "Redação conservadora de descrições com padrões de endereço, conta/agência, documentos, telefone, CEP, placas, matrículas e outros identificadores extensos.",
        "history_method": "Vínculo 2022→2026 exige nome civil + data de nascimento + gênero, com assinatura exata e única nos dois anos.",
        "current_files": [path.name for path in current_files],
    }
    publish(payloads, manifest)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Processa bens declarados de candidaturas 2026 em shards leves por SQ_CANDIDATO.")
    parser.add_argument("source", type=Path, help="Diretório extraído ou ZIP oficial bem_candidato_2026")
    parser.add_argument("--historical-candidates", type=Path, help="Diretório/ZIP consulta_cand_2022")
    parser.add_argument("--historical-assets", type=Path, help="Diretório/ZIP bem_candidato_2022")
    args = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix="patrimonio-cli-") as temp:
        root = Path(temp)
        current_dir = root / "current"
        current_dir.mkdir()
        if args.source.is_dir():
            current_dir = args.source
        else:
            with zipfile.ZipFile(args.source) as archive:
                archive.extractall(current_dir)

        hist_candidates_dir = None
        hist_assets_dir = None
        if args.historical_candidates and args.historical_assets:
            hist_candidates_dir = root / "candidates-2022"
            hist_assets_dir = root / "assets-2022"
            hist_candidates_dir.mkdir()
            hist_assets_dir.mkdir()
            if args.historical_candidates.is_dir():
                hist_candidates_dir = args.historical_candidates
            else:
                with zipfile.ZipFile(args.historical_candidates) as archive:
                    archive.extractall(hist_candidates_dir)
            if args.historical_assets.is_dir():
                hist_assets_dir = args.historical_assets
            else:
                with zipfile.ZipFile(args.historical_assets) as archive:
                    archive.extractall(hist_assets_dir)

        manifest = process(current_dir, hist_candidates_dir, hist_assets_dir)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
