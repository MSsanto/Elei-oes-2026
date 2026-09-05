from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
import tempfile
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "data" / "processed" / "financas-2026"
SOURCE_URL = "https://dadosabertos.tse.jus.br/pt_BR/dataset/prestacao-de-contas-eleitorais-2026"
SHARD_COUNT = 256


def text(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def money_value(value: str) -> Decimal:
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


def normalize_label(value: str) -> str:
    value = re.sub(r"\s+", " ", str(value or "").strip())
    return value or "Não informado"


def normalize_identity(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).upper()


def month_label(value: str) -> str:
    raw = str(value or "").strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%Y %H:%M:%S"):
        try:
            dt = datetime.strptime(raw, fmt)
            return f"{dt.month:02d}/{dt.year}"
        except ValueError:
            pass
    return ""


def candidate_id(row: dict[str, str]) -> str:
    return text(row, "SQ_CANDIDATO", "SQ_CANDIDATO_RECEITA", "SQ_CANDIDATO_DESPESA")


def read_csv(path: Path):
    with path.open("r", encoding="latin-1", errors="replace", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        yield from reader


def find_files(base: Path, pattern: str) -> list[Path]:
    rx = re.compile(pattern, re.I)
    files = sorted(path for path in base.rglob("*.csv") if rx.search(path.name))
    national = [path for path in files if "_BRASIL" in path.name.upper()]
    return national or files


def find_primary_revenue_files(base: Path) -> list[Path]:
    """Retorna somente o livro principal de receitas.

    O RDE publica também `receitas_candidatos_doador_originario_*`, que detalha
    a cadeia anterior de determinadas transferências. Esse arquivo é uma camada
    de rastreabilidade e não representa novas entradas a serem somadas ao total
    recebido pela candidatura.
    """
    return find_files(base, r"^receitas_candidatos_(?!doador_originario).*\.csv$")


def add_sum(store: dict[str, Decimal], key: str, value: Decimal) -> None:
    store[normalize_label(key)] += value


def aggregate_rows(entries: dict[str, Decimal], limit: int | None = None):
    rows = [
        {"categoria": key, "valor": number(value)}
        for key, value in sorted(entries.items(), key=lambda item: item[1], reverse=True)
        if value > 0
    ]
    return rows[:limit] if limit else rows


def aggregate_counterparties(entries: dict[tuple[str, str], Decimal], limit: int = 20):
    return [
        {"nome": name, "tipo": kind, "valor": number(value)}
        for (name, kind), value in sorted(entries.items(), key=lambda item: item[1], reverse=True)[:limit]
        if value > 0
    ]


def shard_key(cid: str) -> str:
    try:
        value = int(str(cid).strip())
    except ValueError:
        value = sum(ord(char) for char in str(cid))
    return f"{value % SHARD_COUNT:02x}"


def supplier_id(name: str, kind: str) -> str:
    raw = f"{normalize_identity(name)}|{normalize_identity(kind)}".encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:16]


def month_sort_key(label: str):
    try:
        month, year = label.split("/", 1)
        return int(year), int(month)
    except (ValueError, AttributeError):
        return 9999, 99


def publish_suppliers(staging: Path, suppliers: dict[tuple[str, str], dict[str, Decimal]], generated: str) -> int:
    base = staging / "fornecedores"
    shards_dir = base / "shards"
    shards_dir.mkdir(parents=True, exist_ok=True)
    index: list[dict] = []
    shards: dict[str, dict[str, dict]] = defaultdict(dict)

    for (name, kind), candidate_values in sorted(suppliers.items(), key=lambda item: (item[0][0], item[0][1])):
        sid = supplier_id(name, kind)
        candidaturas = [
            {"id_tse": cid, "valor": number(value)}
            for cid, value in sorted(candidate_values.items(), key=lambda item: item[0])
            if value > 0
        ]
        if not candidaturas:
            continue
        total = sum((value for value in candidate_values.values()), Decimal("0"))
        record = {
            "schema_version": 1,
            "id": sid,
            "nome": name,
            "tipo": kind,
            "valor_total": number(total),
            "candidaturas": candidaturas,
            "generated_at_utc": generated,
            "source": "TSE — Prestação de Contas Eleitorais 2026",
            "source_url": SOURCE_URL,
        }
        shards[sid[:2]][sid] = record
        index.append({
            "id": sid,
            "nome": name,
            "tipo": kind,
            "valor_total": number(total),
            "candidaturas": len(candidaturas),
        })

    for key, records in sorted(shards.items()):
        (shards_dir / f"{key}.json").write_text(
            json.dumps(records, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    index.sort(key=lambda item: (normalize_identity(item["nome"]), normalize_identity(item["tipo"])))
    (base / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return len(index)


def publish(payloads: dict[str, dict], manifest: dict, suppliers: dict[tuple[str, str], dict[str, Decimal]]) -> None:
    parent = OUTPUT_DIR.parent
    parent.mkdir(parents=True, exist_ok=True)
    staging = parent / ".financas-2026.staging"
    backup = parent / ".financas-2026.backup"

    shutil.rmtree(staging, ignore_errors=True)
    shutil.rmtree(backup, ignore_errors=True)
    shards_dir = staging / "shards"
    shards_dir.mkdir(parents=True, exist_ok=True)

    shards: dict[str, dict[str, dict]] = defaultdict(dict)
    for cid, payload in payloads.items():
        shards[shard_key(cid)][cid] = payload

    for key, records in sorted(shards.items()):
        (shards_dir / f"{key}.json").write_text(
            json.dumps(records, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    manifest["shard_strategy"] = "SQ_CANDIDATO modulo 256 em hexadecimal"
    manifest["shard_count"] = len(shards)
    manifest["shard_slots"] = SHARD_COUNT
    manifest["supplier_count"] = publish_suppliers(staging, suppliers, manifest["generated_at_utc"])
    manifest["supplier_scope"] = "todos os registros processados de despesas contratadas"
    (staging / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
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


def process(source_dir: Path) -> dict:
    revenue_files = find_primary_revenue_files(source_dir)
    donor_origin_files = find_files(source_dir, r"^receitas_candidatos_doador_originario_.*\.csv$")
    expense_files = find_files(source_dir, r"despesas?_contratadas?_candidatos|despesa.*contrat.*candidat")
    paid_files = find_files(source_dir, r"despesas?_pagas?_candidatos|pagamento.*candidat|despesa.*paga.*candidat")

    if not revenue_files and not expense_files:
        raise RuntimeError("Nenhum CSV de receitas/despesas de candidatos foi localizado no pacote informado.")

    data: dict[str, dict] = defaultdict(lambda: {
        "receitas_total": Decimal("0"),
        "despesas_contratadas_total": Decimal("0"),
        "despesas_pagas_total": Decimal("0"),
        "receitas_por_fonte": defaultdict(Decimal),
        "receitas_por_origem": defaultdict(Decimal),
        "despesas_por_categoria": defaultdict(Decimal),
        "doadores": defaultdict(Decimal),
        "fornecedores": defaultdict(Decimal),
        "timeline": defaultdict(lambda: {"receitas": Decimal("0"), "despesas": Decimal("0")}),
    })
    suppliers: dict[tuple[str, str], dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))

    for path in revenue_files:
        for row in read_csv(path):
            cid = candidate_id(row)
            if not cid:
                continue
            value = money_value(text(row, "VR_RECEITA", "VR_RECEITA_CANDIDATO", "VR_RECEITA_FINANCEIRA"))
            if value <= 0:
                continue
            item = data[cid]
            item["receitas_total"] += value
            add_sum(item["receitas_por_fonte"], text(row, "DS_FONTE_RECEITA", "DS_FONTE_RECURSO", "DS_FONTE_ORIGEM"), value)
            add_sum(item["receitas_por_origem"], text(row, "DS_ORIGEM_RECEITA", "DS_TIPO_RECEITA"), value)
            donor = normalize_label(text(row, "NM_DOADOR_RFB", "NM_DOADOR", "NM_RECEITA"))
            donor_type = normalize_label(text(row, "DS_ORIGEM_RECEITA", "DS_TIPO_RECEITA"))
            item["doadores"][(donor, donor_type)] += value
            month = month_label(text(row, "DT_RECEITA", "DT_GERACAO"))
            if month:
                item["timeline"][month]["receitas"] += value

    for path in expense_files:
        for row in read_csv(path):
            cid = candidate_id(row)
            if not cid:
                continue
            value = money_value(text(row, "VR_DESPESA_CONTRATADA", "VR_DESPESA", "VR_DESPESA_CANDIDATO"))
            if value <= 0:
                continue
            item = data[cid]
            item["despesas_contratadas_total"] += value
            add_sum(item["despesas_por_categoria"], text(row, "DS_ORIGEM_DESPESA", "DS_TIPO_DESPESA", "DS_DESPESA"), value)
            supplier = normalize_label(text(row, "NM_FORNECEDOR_RFB", "NM_FORNECEDOR", "NM_FORNECEDOR_ORIGINARIO"))
            supplier_type = normalize_label(text(row, "DS_ORIGEM_DESPESA", "DS_TIPO_DESPESA"))
            item["fornecedores"][(supplier, supplier_type)] += value
            suppliers[(supplier, supplier_type)][cid] += value
            month = month_label(text(row, "DT_DESPESA", "DT_CONTRATACAO", "DT_GERACAO"))
            if month:
                item["timeline"][month]["despesas"] += value

    for path in paid_files:
        for row in read_csv(path):
            cid = candidate_id(row)
            if not cid:
                continue
            value = money_value(text(row, "VR_PAGTO_DESPESA", "VR_PAGAMENTO", "VR_DESPESA_PAGA", "VR_DESPESA"))
            if value > 0:
                data[cid]["despesas_pagas_total"] += value

    generated = datetime.now(timezone.utc).isoformat()
    payloads: dict[str, dict] = {}
    for cid, item in data.items():
        months = sorted(item["timeline"].items(), key=lambda pair: month_sort_key(pair[0]))
        payloads[cid] = {
            "schema_version": 2,
            "source": "TSE — Prestação de Contas Eleitorais 2026",
            "source_url": SOURCE_URL,
            "generated_at_utc": generated,
            "id_tse": cid,
            "resumo": {
                "total_receitas": number(item["receitas_total"]),
                "total_despesas_contratadas": number(item["despesas_contratadas_total"]),
                "total_despesas_pagas": number(item["despesas_pagas_total"]),
            },
            "receitas_por_fonte": aggregate_rows(item["receitas_por_fonte"]),
            "receitas_por_origem": aggregate_rows(item["receitas_por_origem"]),
            "despesas_por_categoria": aggregate_rows(item["despesas_por_categoria"]),
            "principais_doadores": aggregate_counterparties(item["doadores"]),
            "principais_fornecedores": aggregate_counterparties(item["fornecedores"]),
            "timeline": [
                {"mes": month, "receitas": number(values["receitas"]), "despesas": number(values["despesas"])}
                for month, values in months
            ],
        }

    manifest = {
        "schema_version": 2,
        "source": "TSE — Prestação de Contas Eleitorais 2026",
        "source_url": SOURCE_URL,
        "generated_at_utc": generated,
        "candidates": len(payloads),
        "revenue_files": [path.name for path in revenue_files],
        "donor_origin_files_not_summed": [path.name for path in donor_origin_files],
        "expense_files": [path.name for path in expense_files],
        "paid_files": [path.name for path in paid_files],
    }
    publish(payloads, manifest, suppliers)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera shards leves por candidato a partir da Prestação de Contas Eleitorais 2026 do TSE.")
    parser.add_argument("source", type=Path, help="Diretório extraído ou arquivo ZIP oficial do TSE")
    parser.add_argument("--clean", action="store_true", help="Compatibilidade: a publicação já substitui a carga anterior somente após o processamento")
    args = parser.parse_args()

    source = args.source.resolve()
    if not source.exists():
        raise SystemExit(f"Fonte não encontrada: {source}")

    if source.is_dir():
        manifest = process(source)
    else:
        with tempfile.TemporaryDirectory(prefix="eleicoes-financas-") as temp:
            target = Path(temp)
            with zipfile.ZipFile(source) as archive:
                archive.extractall(target)
            manifest = process(target)

    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
