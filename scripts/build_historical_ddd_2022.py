#!/usr/bin/env python3
"""Constrói referência regional histórica por DDD a partir da votação oficial de 2022.

Escopo v1:
- candidaturas atuais a Deputado Federal em 2026;
- correspondência conservadora com candidaturas a Deputado Federal em 2022;
- vínculo apenas quando nome civil + data de nascimento + gênero formam uma
  assinatura normalizada exata e única nos dois anos;
- votos nominais de 2022 somados por município com arquivos oficiais de
  resultados do TSE;
- município convertido para Código Nacional (DDD) pela tabela oficial da Anatel.

O resultado NÃO representa domicílio eleitoral, residência ou endereço.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
CANDIDATES_FILE = PROCESSED / "deputados_federais.json"
TERRITORY_DIR = PROCESSED / "territorio"
HISTORY_FILE = TERRITORY_DIR / "historico_ddd_2022.json"
DDD_MAP_FILE = TERRITORY_DIR / "ddd_municipios.json"
DDD_META_FILE = TERRITORY_DIR / "ddd_metadata.json"

YEAR_CURRENT = 2026
YEAR_HISTORY = 2022
CARGO_CODE = "6"  # Deputado Federal
ELECTION_CODE = "546"  # Eleição Geral 2022 — 1º turno
ELECTION_FILE_CODE = "000546"
CARGO_FILE_CODE = "0006"
RESULTS_BASE = f"https://resultados.tse.jus.br/oficial/ele2022/{ELECTION_CODE}"
GLOBAL_MUNICIPALITIES_URL = f"{RESULTS_BASE}/config/mun-e{ELECTION_FILE_CODE}-cm.json"
DEFAULT_WORKER_URL = "https://eleicoes-2026-tse-browser-probe.matheus-sergio.workers.dev/download"

ANATEL_SOURCES = (
    "https://informacoes.anatel.gov.br/paineis/areas-tarifarias/pgcn",
    "https://informacoes.anatel.gov.br/legislacao/resolucoes/2022/1641-",
)
USER_AGENT = "Eleicoes-2026-Transparencia/0.7 (+https://github.com/MSsanto/Elei-oes-2026)"


def log(message: str) -> None:
    print(message, flush=True)


def normalize(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", " ", text).strip().upper()
    return text


def normalize_date(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    for pattern in (r"^(\d{2})/(\d{2})/(\d{4})$", r"^(\d{4})-(\d{2})-(\d{2})"):
        match = re.match(pattern, text)
        if not match:
            continue
        if pattern.startswith("^(\\d{2})"):
            day, month, year = match.groups()
        else:
            year, month, day = match.groups()
        return f"{day}/{month}/{year}"
    return text


def identity_signature(name: object, birth_date: object, gender: object) -> str:
    return "|".join((normalize(name), normalize_date(birth_date), normalize(gender)))


def signature_hash(signature: str) -> str:
    return hashlib.sha256(f"identity-v1|{signature}".encode("utf-8")).hexdigest()


def decode_csv(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")


def request(url: str, *, accept: str = "application/json,text/plain,*/*") -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": accept,
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
        },
    )


def fetch_bytes(url: str, *, attempts: int = 3, timeout: int = 60) -> bytes:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(request(url), timeout=timeout) as response:
                return response.read()
        except urllib.error.HTTPError:
            raise
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_error = exc
            if attempt < attempts:
                time.sleep(attempt * 1.5)
    raise RuntimeError(f"Falha ao consultar {url}: {last_error}")


def fetch_json(url: str, *, attempts: int = 3, timeout: int = 60) -> object:
    raw = fetch_bytes(url, attempts=attempts, timeout=timeout)
    return json.loads(raw.decode("utf-8-sig"))


def download_candidates_2022() -> Path:
    worker_url = os.environ.get("TSE_WORKER_URL", DEFAULT_WORKER_URL).strip()
    token = os.environ.get("TSE_WORKER_TOKEN", "").strip()
    if not token:
        raise RuntimeError("TSE_WORKER_TOKEN ausente")

    separator = "&" if "?" in worker_url else "?"
    url = f"{worker_url}{separator}{urllib.parse.urlencode({'dataset': 'candidatos2022'})}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/zip",
            "User-Agent": USER_AGENT,
        },
    )
    target = Path(tempfile.gettempdir()) / "consulta_cand_2022.zip"
    with urllib.request.urlopen(req, timeout=180) as response:
        dataset = (response.headers.get("X-TSE-Dataset") or "").strip().lower()
        payload = response.read()
    if dataset != "candidatos2022":
        raise RuntimeError(
            f"Worker ativo não confirmou candidatos2022 (X-TSE-Dataset={dataset!r}). "
            "Aguarde o deploy da revisão que suporta o arquivo histórico."
        )
    if not payload.startswith(b"PK"):
        raise RuntimeError("Resposta do Worker para candidatos2022 não é um ZIP válido")
    target.write_bytes(payload)
    log(f"TSE 2022: consulta_cand_2022.zip recebido ({len(payload) / 1024 / 1024:.1f} MB)")
    return target


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


def download_text(url: str) -> str:
    raw = fetch_bytes(url, timeout=50)
    for encoding in ("utf-8", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            pass
    return raw.decode("utf-8", errors="replace")


def load_ddd_mapping() -> tuple[dict[tuple[str, str], str], str]:
    TERRITORY_DIR.mkdir(parents=True, exist_ok=True)
    for source in ANATEL_SOURCES:
        try:
            mapping = parse_pgcn_html(download_text(source))
            if len(mapping) >= 5000:
                snapshot = [
                    {"uf": uf, "municipio": municipality, "ddd": ddd}
                    for (uf, municipality), ddd in sorted(mapping.items())
                ]
                DDD_MAP_FILE.write_text(
                    json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
                )
                DDD_META_FILE.write_text(
                    json.dumps(
                        {
                            "source": "Agência Nacional de Telecomunicações (Anatel)",
                            "source_url": source,
                            "records": len(mapping),
                            "field": "Código Nacional (DDD) por município",
                            "nota": "Tabela territorial; não contém informação individual de candidatos.",
                        },
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )
                log(f"Anatel: {len(mapping)} municípios/CNs carregados")
                return mapping, source
            log(f"Anatel: {source} retornou só {len(mapping)} linhas úteis; tentando outra fonte oficial")
        except Exception as exc:
            log(f"Anatel: falha em {source}: {exc}")

    if DDD_MAP_FILE.exists():
        payload = json.loads(DDD_MAP_FILE.read_text(encoding="utf-8"))
        mapping = {
            (normalize(item.get("uf")), normalize(item.get("municipio"))): str(item.get("ddd") or "")
            for item in payload
            if isinstance(item, dict)
        }
        mapping = {key: value for key, value in mapping.items() if re.fullmatch(r"\d{2}", value)}
        if len(mapping) >= 5000:
            log(f"Anatel: usando snapshot oficial versionado com {len(mapping)} municípios/CNs")
            return mapping, "snapshot_local_anatel"
    raise RuntimeError("Não foi possível obter a tabela oficial município → DDD da Anatel")


def current_candidates() -> list[dict]:
    payload = json.loads(CANDIDATES_FILE.read_text(encoding="utf-8"))
    if not isinstance(payload, list) or not payload:
        raise RuntimeError(f"Base 2026 ausente ou vazia: {CANDIDATES_FILE}")
    return payload


def candidates_2022(zip_path: Path) -> list[dict]:
    rows: list[dict] = []
    with zipfile.ZipFile(zip_path) as archive:
        names = [
            name for name in archive.namelist()
            if Path(name).name.lower().startswith("consulta_cand_2022") and name.lower().endswith(".csv")
        ]
        brasil = next(
            (name for name in names if Path(name).name.upper() == "CONSULTA_CAND_2022_BRASIL.CSV"), None
        )
        selected = [brasil] if brasil else names
        for name in selected:
            reader = csv.DictReader(io.StringIO(decode_csv(archive.read(name))), delimiter=";")
            for row in reader:
                if str(row.get("CD_CARGO") or "").strip() != CARGO_CODE:
                    continue
                candidate_id = str(row.get("SQ_CANDIDATO") or "").strip()
                if not candidate_id:
                    continue
                rows.append(
                    {
                        "id_tse": candidate_id,
                        "nome": str(row.get("NM_CANDIDATO") or "").strip(),
                        "data_nascimento": str(row.get("DT_NASCIMENTO") or "").strip(),
                        "genero": str(row.get("DS_GENERO") or "").strip(),
                        "uf": str(row.get("SG_UF") or "").strip().upper(),
                    }
                )
    log(f"TSE 2022: {len(rows)} candidaturas a Deputado Federal lidas")
    return rows


def exact_unique_matches(current: list[dict], historical: list[dict]) -> dict[str, dict]:
    current_by_signature: dict[str, list[dict]] = defaultdict(list)
    history_by_signature: dict[str, list[dict]] = defaultdict(list)

    for candidate in current:
        sig = identity_signature(candidate.get("nome"), candidate.get("data_nascimento"), candidate.get("genero"))
        if all(sig.split("|")):
            current_by_signature[sig].append(candidate)
    for candidate in historical:
        sig = identity_signature(candidate.get("nome"), candidate.get("data_nascimento"), candidate.get("genero"))
        if all(sig.split("|")):
            history_by_signature[sig].append(candidate)

    matches: dict[str, dict] = {}
    ambiguous = 0
    for sig, current_rows in current_by_signature.items():
        historical_rows = history_by_signature.get(sig, [])
        if len(current_rows) == 1 and len(historical_rows) == 1:
            current_candidate = current_rows[0]
            historical_candidate = historical_rows[0]
            matches[str(current_candidate.get("id_tse") or "")] = {
                "id_tse_2026": str(current_candidate.get("id_tse") or ""),
                "sq_candidato_2022": historical_candidate["id_tse"],
                "uf_2022": historical_candidate["uf"],
                "signature_hash": signature_hash(sig),
            }
        elif historical_rows:
            ambiguous += 1

    log(
        f"Vínculo 2026↔2022: {len(matches)} correspondências exatas e únicas; "
        f"{ambiguous} assinatura(s) com ambiguidade descartadas"
    )
    return matches


def walk(value: object):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def collect_strings(value: object):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from collect_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from collect_strings(child)


def plausible_codes_from_objects(payload: object, uf: str) -> set[str]:
    codes: set[str] = set()
    code_keys = {"cd", "cdabr", "cdmu", "cdmun", "cdmunicipio", "codmunicipio", "codigo"}
    for obj in walk(payload):
        if not isinstance(obj, dict):
            continue
        normalized = {normalize(key).lower(): value for key, value in obj.items()}
        for key, value in normalized.items():
            key_simple = re.sub(r"[^a-z]", "", key)
            if key_simple not in code_keys and "mun" not in key_simple and "abr" not in key_simple:
                continue
            digits = re.sub(r"\D", "", str(value or ""))
            if len(digits) == 5:
                codes.add(digits)
    return codes


def municipality_codes_for_uf(uf: str) -> list[str]:
    uf_lower = uf.lower()
    index_url = f"{RESULTS_BASE}/config/{uf_lower}/{uf_lower}-e{ELECTION_FILE_CODE}-i.json"
    payload = fetch_json(index_url)
    serialized = json.dumps(payload, ensure_ascii=False)
    pattern = re.compile(
        rf"{re.escape(uf_lower)}(\d{{5}})-c{CARGO_FILE_CODE}-e{ELECTION_FILE_CODE}-v\.json",
        re.IGNORECASE,
    )
    exact = set(pattern.findall(serialized))
    if exact:
        return sorted(exact)

    candidates = plausible_codes_from_objects(payload, uf)
    if candidates:
        log(f"{uf}: índice sem nomes de arquivo explícitos; {len(candidates)} códigos plausíveis encontrados")
        return sorted(candidates)

    global_payload = fetch_json(GLOBAL_MUNICIPALITIES_URL)
    global_candidates: set[str] = set()
    for obj in walk(global_payload):
        if not isinstance(obj, dict):
            continue
        values = [normalize(value) for value in obj.values() if isinstance(value, (str, int))]
        if uf not in values:
            continue
        global_candidates.update(plausible_codes_from_objects(obj, uf))
    if global_candidates:
        log(f"{uf}: usando configuração global com {len(global_candidates)} municípios")
        return sorted(global_candidates)

    raise RuntimeError(f"{uf}: não foi possível descobrir os códigos municipais oficiais sem gerar 404 em massa")


def result_url(uf: str, municipality_code: str) -> str:
    uf_lower = uf.lower()
    return (
        f"{RESULTS_BASE}/dados/{uf_lower}/"
        f"{uf_lower}{municipality_code}-c{CARGO_FILE_CODE}-e{ELECTION_FILE_CODE}-v.json"
    )


def find_municipality_name(payload: object) -> str:
    if isinstance(payload, dict):
        for key in ("nmabr", "nmAbr", "nm_municipio", "municipio"):
            value = payload.get(key)
            if value:
                return str(value).strip()
    for obj in walk(payload):
        if not isinstance(obj, dict):
            continue
        for key, value in obj.items():
            if normalize(key).lower() == "nmabr" and value:
                return str(value).strip()
    return ""


def find_candidate_rows(payload: object) -> list[dict]:
    if isinstance(payload, dict) and isinstance(payload.get("cand"), list):
        return [item for item in payload["cand"] if isinstance(item, dict)]
    for obj in walk(payload):
        if not isinstance(obj, dict):
            continue
        for value in obj.values():
            if not isinstance(value, list) or not value:
                continue
            sample = next((item for item in value if isinstance(item, dict)), None)
            if sample and any(normalize(key).lower() == "sqcand" for key in sample):
                return [item for item in value if isinstance(item, dict)]
    return []


def row_value(row: dict, wanted: str):
    wanted_norm = normalize(wanted).lower()
    for key, value in row.items():
        if normalize(key).lower() == wanted_norm:
            return value
    return None


def to_int(value: object) -> int:
    if isinstance(value, int):
        return value
    digits = re.sub(r"\D", "", str(value or ""))
    return int(digits) if digits else 0


def read_municipality_result(
    uf: str,
    code: str,
    target_2022: set[str],
    ddd_mapping: dict[tuple[str, str], str],
) -> tuple[str, str, dict[str, int], int, int]:
    url = result_url(uf, code)
    try:
        payload = fetch_json(url, attempts=3, timeout=50)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return code, "", {}, 0, 404
        raise

    municipality = find_municipality_name(payload)
    ddd = ddd_mapping.get((normalize(uf), normalize(municipality)), "") if municipality else ""
    votes: dict[str, int] = {}
    for row in find_candidate_rows(payload):
        sqcand = str(row_value(row, "sqcand") or "").strip()
        if sqcand not in target_2022:
            continue
        votes[sqcand] = to_int(row_value(row, "vap"))
    return code, ddd, votes, sum(votes.values()), 200


def historical_votes(
    matches: dict[str, dict],
    ddd_mapping: dict[tuple[str, str], str],
    *,
    selected_ufs: set[str] | None,
    workers: int,
) -> tuple[dict[str, Counter], Counter, dict[str, dict]]:
    by_uf: dict[str, dict[str, str]] = defaultdict(dict)
    for current_id, match in matches.items():
        uf = str(match.get("uf_2022") or "").upper()
        if not uf or (selected_ufs and uf not in selected_ufs):
            continue
        by_uf[uf][str(match["sq_candidato_2022"])] = current_id

    votes_by_current: dict[str, Counter] = defaultdict(Counter)
    totals: Counter = Counter()
    diagnostics: dict[str, dict] = {}

    for uf in sorted(by_uf):
        target_map = by_uf[uf]
        target_sqs = set(target_map)
        codes = municipality_codes_for_uf(uf)
        if not codes:
            raise RuntimeError(f"{uf}: lista de municípios vazia")

        # Um único probe evita disparar centenas de 404 caso o formato do índice tenha mudado.
        probe_code = codes[0]
        probe = read_municipality_result(uf, probe_code, target_sqs, ddd_mapping)
        if probe[4] == 404:
            raise RuntimeError(
                f"{uf}: primeiro código municipal ({probe_code}) gerou 404. "
                "Interrompido para proteger contra bloqueio por URLs incorretas."
            )

        processed = 0
        not_found = 0
        mapped_municipalities = 0

        def consume(result_tuple):
            nonlocal processed, not_found, mapped_municipalities
            _, ddd, votes, _, status = result_tuple
            if status == 404:
                not_found += 1
                return
            processed += 1
            if ddd:
                mapped_municipalities += 1
            for sqcand, count in votes.items():
                if count <= 0:
                    continue
                current_id = target_map.get(sqcand)
                if not current_id:
                    continue
                totals[current_id] += count
                if ddd:
                    votes_by_current[current_id][ddd] += count

        consume(probe)
        remaining = codes[1:]
        with ThreadPoolExecutor(max_workers=max(1, min(workers, 8))) as pool:
            futures = {
                pool.submit(read_municipality_result, uf, code, target_sqs, ddd_mapping): code
                for code in remaining
            }
            for future in as_completed(futures):
                consume(future.result())

        if not_found > 3:
            raise RuntimeError(
                f"{uf}: {not_found} arquivos municipais retornaram 404. "
                "Execução interrompida para não insistir em um padrão possivelmente incorreto."
            )
        diagnostics[uf] = {
            "municipios_listados": len(codes),
            "municipios_processados": processed,
            "municipios_com_ddd": mapped_municipalities,
            "arquivos_404": not_found,
            "candidaturas_2022_alvo": len(target_sqs),
        }
        log(
            f"{uf}: {processed}/{len(codes)} municípios processados; "
            f"{mapped_municipalities} associados a DDD; {len(target_sqs)} candidaturas-alvo"
        )

    return votes_by_current, totals, diagnostics


def build_records(
    matches: dict[str, dict], votes_by_current: dict[str, Counter], totals: Counter
) -> dict[str, dict]:
    records: dict[str, dict] = {}
    for current_id, match in matches.items():
        distribution = votes_by_current.get(current_id, Counter())
        votes_total = int(totals.get(current_id, 0))
        votes_with_ddd = int(sum(distribution.values()))
        if votes_total <= 0 or votes_with_ddd <= 0:
            continue

        max_votes = max(distribution.values())
        principal = sorted(ddd for ddd, count in distribution.items() if count == max_votes)
        items = []
        for ddd, count in sorted(distribution.items(), key=lambda item: (-item[1], item[0])):
            items.append(
                {
                    "ddd": ddd,
                    "votos": int(count),
                    "percentual": round((count / votes_with_ddd) * 100, 2),
                }
            )

        records[current_id] = {
            "status": "confirmado_por_identidade_exata_unica",
            "ano": YEAR_HISTORY,
            "cargo": "DEPUTADO FEDERAL",
            "sq_candidato_2022": match["sq_candidato_2022"],
            "uf_2022": match["uf_2022"],
            "signature_hash": match["signature_hash"],
            "ddd_principal": principal[0],
            "ddds_principais": principal,
            "percentual_ddd_principal": round((max_votes / votes_with_ddd) * 100, 2),
            "votos_nominais_total": votes_total,
            "votos_com_ddd": votes_with_ddd,
            "cobertura_ddd_percentual": round((votes_with_ddd / votes_total) * 100, 2),
            "distribuicao_ddd": items,
            "nota": (
                "DDD principal da votação nominal mapeada em 2022; não representa domicílio eleitoral, "
                "residência ou área atual de atuação."
            ),
        }
    return records


def parse_ufs(value: str) -> set[str] | None:
    text = normalize(value)
    if not text or text == "ALL":
        return None
    ufs = {item.strip().upper() for item in text.split(",") if item.strip()}
    invalid = {item for item in ufs if not re.fullmatch(r"[A-Z]{2}", item)}
    if invalid:
        raise ValueError(f"UFs inválidas: {sorted(invalid)}")
    return ufs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ufs", default="ALL", help="ALL ou lista separada por vírgulas, ex.: SP,RJ")
    parser.add_argument("--workers", type=int, default=6, help="Concorrência máxima para arquivos municipais (1-8)")
    args = parser.parse_args()

    selected_ufs = parse_ufs(args.ufs)
    workers = max(1, min(args.workers, 8))
    TERRITORY_DIR.mkdir(parents=True, exist_ok=True)

    current = current_candidates()
    historical = candidates_2022(download_candidates_2022())
    matches = exact_unique_matches(current, historical)
    if not matches:
        raise RuntimeError("Nenhuma correspondência exata e única 2026↔2022 encontrada")

    ddd_mapping, ddd_source = load_ddd_mapping()
    votes_by_current, totals, diagnostics = historical_votes(
        matches,
        ddd_mapping,
        selected_ufs=selected_ufs,
        workers=workers,
    )
    records = build_records(matches, votes_by_current, totals)

    if selected_ufs and HISTORY_FILE.exists():
        previous = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        previous_records = previous.get("records", {}) if isinstance(previous, dict) else {}
        if isinstance(previous_records, dict):
            processed_current_ids = {
                current_id
                for current_id, match in matches.items()
                if str(match.get("uf_2022") or "").upper() in selected_ufs
            }
            merged = {
                key: value for key, value in previous_records.items()
                if key not in processed_current_ids
            }
            merged.update(records)
            records = merged

    metadata = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_votes": "Tribunal Superior Eleitoral (TSE) — Resultados 2022",
        "results_base_url": RESULTS_BASE,
        "source_candidates_2022": (
            "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2022.zip"
        ),
        "source_ddd": "Agência Nacional de Telecomunicações (Anatel) — Códigos Nacionais",
        "source_ddd_url": ddd_source,
        "year": YEAR_HISTORY,
        "cargo": "DEPUTADO FEDERAL",
        "identity_method": (
            "nome civil + data de nascimento + gênero; normalização de acentos/caixa/espaços; "
            "assinatura aceita somente quando única em 2026 e em 2022"
        ),
        "matches_exact_unique": len(matches),
        "records_with_historical_ddd": len(records),
        "selected_ufs": sorted(selected_ufs) if selected_ufs else "ALL",
        "diagnostics_by_uf": diagnostics,
        "definition": (
            "DDD principal = Código Nacional da Anatel associado aos municípios que, somados, "
            "concentraram a maior quantidade de votos nominais mapeados para a candidatura em 2022."
        ),
        "privacy_and_semantics": (
            "Não usa título eleitoral, CPF ou endereço para formar o vínculo. Não representa domicílio eleitoral, "
            "residência, endereço ou área atual de atuação política."
        ),
    }
    HISTORY_FILE.write_text(
        json.dumps({"metadata": metadata, "records": records}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Reaplica imediatamente ao JSON público de 2026.
    from apply_historical_ddd import apply_history

    applied = apply_history()
    log(
        f"Mapa histórico concluído: {len(records)} registros; "
        f"{applied['with_principal_ddd']} candidaturas de 2026 com DDD histórico principal."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
