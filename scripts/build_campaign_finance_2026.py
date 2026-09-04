from __future__ import annotations

import argparse
import csv
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
    return sorted(path for path in base.rglob("*.csv") if rx.search(path.name))


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


def process(source_dir: Path) -> dict:
    revenue_files = find_files(source_dir, r"receitas?_candidatos|receita.*candidat")
    expense_files = find_files(source_dir, r"despesas?_contratadas?_candidatos|despesa.*candidat")
    paid_files = find_files(source_dir, r"despesas?_pagas?_candidatos|pagamento.*candidat")

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
            donor = normalize_label(text(row, "NM_DOADOR_RFB", "NM_DOADOR", "NM_DOADOR_ORIGINARIO", "NM_RECEITA"))
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
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    written = 0

    for cid, item in data.items():
        months = sorted(item["timeline"].items(), key=lambda pair: tuple(reversed(pair[0].split("/"))))
        payload = {
            "schema_version": 1,
            "source": "TSE — Prestação de Contas Eleitorais 2026",
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
        (OUTPUT_DIR / f"{cid}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        written += 1

    manifest = {
        "schema_version": 1,
        "source": "TSE — Prestação de Contas Eleitorais 2026",
        "generated_at_utc": generated,
        "candidates": written,
        "revenue_files": [path.name for path in revenue_files],
        "expense_files": [path.name for path in expense_files],
        "paid_files": [path.name for path in paid_files],
    }
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera JSONs leves por candidato a partir da Prestação de Contas Eleitorais 2026 do TSE.")
    parser.add_argument("source", type=Path, help="Diretório extraído ou arquivo ZIP oficial do TSE")
    parser.add_argument("--clean", action="store_true", help="Limpa a saída anterior antes de gerar a nova carga")
    args = parser.parse_args()

    if args.clean and OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)

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
