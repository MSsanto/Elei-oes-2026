#!/usr/bin/env python3
"""Enriquece candidaturas com referência territorial factual.

A primeira versão usa APENAS a naturalidade publicada pelo TSE:
- UF de nascimento;
- município de nascimento;
- DDD/Código Nacional correspondente ao município, cruzado com tabela oficial da Anatel.

O DDD gerado aqui NÃO representa domicílio eleitoral, base eleitoral ou área de atuação.
Ele é publicado como `ddd_nascimento` justamente para evitar essa interpretação.
"""

from __future__ import annotations

import csv
import io
import json
import re
import time
import unicodedata
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_ZIP = ROOT / "data" / "raw" / "consulta_cand_2026.zip"
PROCESSED = ROOT / "data" / "processed"
CANDIDATES_FILE = PROCESSED / "deputados_federais.json"
UF_DIR = PROCESSED / "ufs"
META_FILE = PROCESSED / "metadata.json"
TERRITORY_DIR = PROCESSED / "territorio"
DDD_MAP_FILE = TERRITORY_DIR / "ddd_municipios.json"
DDD_META_FILE = TERRITORY_DIR / "ddd_metadata.json"

# A página normativa da Anatel contém a tabela completa Codigo_IBGE / UF / Municipio / Codigo_Nacional.
# A página do painel atual é tentada primeiro; se ela não expuser a tabela em HTML, usamos a tabela
# normativa oficial como fallback de máquina. A proveniência fica registrada no metadata.
ANATEL_SOURCES = (
    "https://informacoes.anatel.gov.br/paineis/areas-tarifarias/pgcn",
    "https://informacoes.anatel.gov.br/legislacao/resolucoes/2022/1641-",
)
USER_AGENT = "Eleicoes-2026-Transparencia/0.5 (+https://github.com/MSsanto/Elei-oes-2026)"


def normalize(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", " ", text).strip().upper()
    return text


def clean_tse(value: object) -> str:
    text = str(value or "").strip()
    if not text or text.upper() in {"#NULO", "#NE", "NÃO DIVULGÁVEL", "NAO DIVULGAVEL", "-1"}:
        return ""
    return text


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_cell = False
        self.cell_parts: list[str] = []
        self.row: list[str] | None = None
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.lower()
        if tag == "tr":
            self.row = []
        elif tag in {"td", "th"} and self.row is not None:
            self.in_cell = True
            self.cell_parts = []

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.cell_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"td", "th"} and self.in_cell:
            if self.row is not None:
                self.row.append(" ".join("".join(self.cell_parts).split()))
            self.in_cell = False
            self.cell_parts = []
        elif tag == "tr" and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None


def parse_pgcn_html(html: str) -> dict[tuple[str, str], str]:
    parser = TableParser()
    parser.feed(html)
    mapping: dict[tuple[str, str], str] = {}

    for cells in parser.rows:
        # Formato oficial mais comum: Codigo_IBGE | UF | Municipio | Codigo_Nacional.
        # Também aceitamos tabelas de 3 colunas: UF | Municipio | Codigo_Nacional.
        if len(cells) >= 4 and re.fullmatch(r"\d{7}", cells[0].strip()):
            uf, municipality, ddd = cells[1], cells[2], cells[3]
        elif len(cells) >= 3 and re.fullmatch(r"[A-Za-z]{2}", cells[0].strip()):
            uf, municipality, ddd = cells[0], cells[1], cells[2]
        else:
            continue

        uf = normalize(uf)
        municipality = normalize(municipality)
        ddd = re.sub(r"\D", "", str(ddd))
        if re.fullmatch(r"[A-Z]{2}", uf) and municipality and re.fullmatch(r"\d{2}", ddd):
            mapping[(uf, municipality)] = ddd

    return mapping


def download_text(url: str, attempts: int = 3) -> str:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
            )
            with urllib.request.urlopen(request, timeout=45) as response:
                raw = response.read()
            for encoding in ("utf-8", "latin-1"):
                try:
                    return raw.decode(encoding)
                except UnicodeDecodeError:
                    pass
            return raw.decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_error = exc
            if attempt < attempts:
                time.sleep(attempt * 2)
    raise RuntimeError(f"Falha ao consultar {url}: {last_error}")


def load_ddd_mapping() -> tuple[dict[tuple[str, str], str], str]:
    TERRITORY_DIR.mkdir(parents=True, exist_ok=True)

    for source in ANATEL_SOURCES:
        try:
            mapping = parse_pgcn_html(download_text(source))
            if len(mapping) >= 5000:
                serializable = [
                    {"uf": uf, "municipio": municipality, "ddd": ddd}
                    for (uf, municipality), ddd in sorted(mapping.items())
                ]
                DDD_MAP_FILE.write_text(
                    json.dumps(serializable, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8",
                )
                DDD_META_FILE.write_text(
                    json.dumps(
                        {
                            "source": "Agência Nacional de Telecomunicações (Anatel)",
                            "source_url": source,
                            "records": len(mapping),
                            "field": "Código Nacional (DDD) por município",
                            "nota": "O DDD é usado apenas como referência da naturalidade informada ao TSE; não representa domicílio eleitoral.",
                        },
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )
                print(f"Anatel: {len(mapping)} municípios/CNs carregados de {source}")
                return mapping, source
            print(f"Anatel: fonte {source} não expôs tabela completa em HTML ({len(mapping)} linhas úteis).")
        except Exception as exc:
            print(f"Anatel: falha em {source}: {exc}")

    if DDD_MAP_FILE.exists():
        payload = json.loads(DDD_MAP_FILE.read_text(encoding="utf-8"))
        mapping = {
            (normalize(item.get("uf")), normalize(item.get("municipio"))): str(item.get("ddd") or "")
            for item in payload
            if isinstance(item, dict)
        }
        mapping = {key: value for key, value in mapping.items() if value}
        if mapping:
            print(f"Anatel: usando snapshot local com {len(mapping)} municípios/CNs.")
            return mapping, "snapshot_local_anatel"

    raise RuntimeError("Não foi possível obter nem reutilizar uma tabela válida de DDD por município da Anatel.")


def decode_csv(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")


def read_birthplaces() -> dict[str, tuple[str, str]]:
    if not RAW_ZIP.exists():
        raise RuntimeError(f"ZIP do TSE não encontrado: {RAW_ZIP}")

    records: dict[str, tuple[str, str]] = {}
    with zipfile.ZipFile(RAW_ZIP) as archive:
        names = [
            name for name in archive.namelist()
            if Path(name).name.lower().startswith("consulta_cand_2026") and name.lower().endswith(".csv")
        ]
        brasil = next((name for name in names if Path(name).name.upper() == "CONSULTA_CAND_2026_BRASIL.CSV"), None)
        selected = [brasil] if brasil else names

        for name in selected:
            reader = csv.DictReader(io.StringIO(decode_csv(archive.read(name))), delimiter=";")
            for row in reader:
                cargo_code = str(row.get("CD_CARGO") or "").strip()
                cargo_name = normalize(row.get("DS_CARGO"))
                if cargo_code != "6" and cargo_name != "DEPUTADO FEDERAL":
                    continue
                candidate_id = clean_tse(row.get("SQ_CANDIDATO"))
                if not candidate_id:
                    continue
                uf_birth = clean_tse(row.get("SG_UF_NASCIMENTO"))
                municipality_birth = clean_tse(row.get("NM_MUNICIPIO_NASCIMENTO"))
                records[candidate_id] = (uf_birth.upper(), municipality_birth)

    return records


def write_candidates(candidates: list[dict]) -> None:
    CANDIDATES_FILE.write_text(
        json.dumps(candidates, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    UF_DIR.mkdir(parents=True, exist_ok=True)
    grouped: dict[str, list[dict]] = defaultdict(list)
    for candidate in candidates:
        grouped[str(candidate.get("uf") or "")].append(candidate)
    for uf, records in grouped.items():
        if uf:
            (UF_DIR / f"{uf}.json").write_text(
                json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
            )


def main() -> int:
    if not CANDIDATES_FILE.exists():
        raise SystemExit(f"Base de candidatos ausente: {CANDIDATES_FILE}")

    candidates = json.loads(CANDIDATES_FILE.read_text(encoding="utf-8"))
    if not isinstance(candidates, list) or not candidates:
        raise SystemExit("Base de candidatos vazia ou inválida.")

    birthplaces = read_birthplaces()
    ddd_mapping, ddd_source = load_ddd_mapping()

    enriched = 0
    matched_ddd = 0
    for candidate in candidates:
        candidate_id = str(candidate.get("id_tse") or "")
        uf_birth, municipality_birth = birthplaces.get(candidate_id, ("", ""))
        ddd = ddd_mapping.get((normalize(uf_birth), normalize(municipality_birth)), "") if municipality_birth else ""

        candidate["uf_nascimento"] = uf_birth
        candidate["municipio_nascimento"] = municipality_birth
        candidate["ddd_nascimento"] = ddd
        if uf_birth or municipality_birth:
            enriched += 1
        if ddd:
            matched_ddd += 1

    write_candidates(candidates)

    metadata = json.loads(META_FILE.read_text(encoding="utf-8")) if META_FILE.exists() else {}
    metadata["regionalizacao"] = {
        "tipo": "naturalidade",
        "campo_tse": "NM_MUNICIPIO_NASCIMENTO / SG_UF_NASCIMENTO",
        "fonte_ddd": "Agência Nacional de Telecomunicações (Anatel)",
        "fonte_ddd_url": ddd_source,
        "candidaturas_com_naturalidade": enriched,
        "candidaturas_com_ddd": matched_ddd,
        "nota": "DDD associado ao município de nascimento; não representa domicílio eleitoral, base eleitoral ou área de atuação.",
    }
    META_FILE.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Regionalização: {enriched}/{len(candidates)} com naturalidade; {matched_ddd}/{len(candidates)} com DDD confirmado.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
