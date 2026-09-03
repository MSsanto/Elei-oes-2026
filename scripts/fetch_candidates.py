from __future__ import annotations

import csv
import io
import json
import time
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

YEAR = 2026
CARGO_CODE = "6"  # Deputado Federal
BASE_URL = "https://divulgacandcontas.tse.jus.br/divulga/rest/v1"
ELECTIONS_URL = f"{BASE_URL}/eleicao/ordinarias"
CANDIDATES_ZIP_URL = (
    "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/"
    "consulta_cand_2026.zip"
)

UFS = (
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT",
    "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO",
    "RR", "SC", "SP", "SE", "TO",
)

ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = ROOT / "data" / "processed"
UF_DIR = PROCESSED_DIR / "ufs"
RAW_DIR = ROOT / "data" / "raw"
OUTPUT_PATH = PROCESSED_DIR / "deputados_federais.json"
META_PATH = PROCESSED_DIR / "metadata.json"
RAW_ZIP_PATH = RAW_DIR / "consulta_cand_2026.zip"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/152.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
    "Referer": "https://divulgacandcontas.tse.jus.br/",
}


def log(message: str) -> None:
    print(message, flush=True)


def make_request(url: str) -> urllib.request.Request:
    return urllib.request.Request(url, headers=HEADERS)


def download(url: str, destination: Path, attempts: int = 4) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(destination.suffix + ".tmp")
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            log(f"Baixando arquivo oficial do TSE (tentativa {attempt}/{attempts})...")
            with urllib.request.urlopen(make_request(url), timeout=180) as response, partial.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            partial.replace(destination)
            log(
                f"Download concluído: {destination.name} "
                f"({destination.stat().st_size / 1024 / 1024:.1f} MB)"
            )
            return destination
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last_error = error
            partial.unlink(missing_ok=True)
            if attempt < attempts:
                wait = attempt * 3
                log(f"Falha no download: {error}. Tentando novamente em {wait}s...")
                time.sleep(wait)

    raise RuntimeError(f"Não foi possível baixar {url}: {last_error}")


def fetch_json(url: str, attempts: int = 4) -> object:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(make_request(url), timeout=120) as response:
                return json.load(response)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            if attempt < attempts:
                wait = attempt * 2
                log(f"Consulta falhou ({error}). Nova tentativa em {wait}s...")
                time.sleep(wait)
    raise RuntimeError(f"Falha ao consultar {url}: {last_error}")


def walk_objects(value: object):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_objects(child)


def discover_election_id() -> int:
    payload = fetch_json(ELECTIONS_URL)
    matches: list[dict[str, object]] = []
    for item in walk_objects(payload):
        try:
            year = int(item.get("ano") or item.get("anoEleicao") or item.get("nrAno") or 0)
        except (TypeError, ValueError):
            year = 0
        if year == YEAR:
            matches.append(item)

    if not matches:
        raise RuntimeError(f"Eleição ordinária de {YEAR} não encontrada no DivulgaCandContas.")

    first_turn = next(
        (
            item
            for item in matches
            if str(item.get("turno") or item.get("nrTurno") or "1") == "1"
        ),
        matches[0],
    )
    value = (
        first_turn.get("id")
        or first_turn.get("idEleicao")
        or first_turn.get("sqEleicao")
        or first_turn.get("sq_ELEICAO")
    )
    if value in (None, ""):
        raise RuntimeError("O TSE retornou a eleição de 2026 sem um identificador utilizável.")
    return int(value)


def first(row: dict[str, object], *names: str, default: object = "") -> object:
    for name in names:
        value = row.get(name)
        if value not in (None, ""):
            return value
    return default


def normalize_date(value: object) -> str:
    if value in (None, ""):
        return ""
    text = str(value).strip()
    if text.isdigit() and len(text) >= 10:
        try:
            numeric = int(text)
            if numeric > 10_000_000_000:
                numeric = numeric / 1000
            return datetime.fromtimestamp(numeric, tz=timezone.utc).strftime("%d/%m/%Y")
        except (ValueError, OSError):
            return text
    return text


def normalize_candidate(
    row: dict[str, object],
    *,
    uf_hint: str = "",
    election_id: int | None = None,
) -> dict[str, object]:
    party_obj = row.get("partido") if isinstance(row.get("partido"), dict) else {}

    candidate_id = first(row, "id", "sq_CANDIDATO", "sqCandidato", "SQ_CANDIDATO")
    number = first(row, "numero", "nr_CANDIDATO", "nrCandidato", "NR_CANDIDATO")
    name = first(row, "nomeCompleto", "nm_CANDIDATO", "nome", "NM_CANDIDATO")
    ballot_name = first(
        row,
        "nomeUrna",
        "nm_URNA",
        "nmUrna",
        "NM_URNA_CANDIDATO",
        default=name,
    )
    uf = str(first(row, "ufCandidatura", "SG_UF", default=uf_hint)).upper()
    party = first(
        party_obj if isinstance(party_obj, dict) else {},
        "sigla",
        default=first(row, "sg_PARTIDO", "siglaPartido", "SG_PARTIDO"),
    )
    party_number = first(
        party_obj if isinstance(party_obj, dict) else {},
        "numero",
        default=first(row, "nr_PARTIDO", "numeroPartido", "NR_PARTIDO"),
    )

    photo = first(row, "fotoUrl", "urlFoto", "FOTO_URL")
    if not photo and election_id and candidate_id and uf:
        photo = (
            "https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/"
            f"{election_id}/{candidate_id}/{uf}"
        )

    return {
        "ano_eleicao": str(first(row, "ANO_ELEICAO", default=YEAR)),
        "uf": uf,
        "id_tse": str(candidate_id or ""),
        "numero": str(number or ""),
        "nome": str(name or ""),
        "nome_urna": str(ballot_name or name or ""),
        "partido": str(party or ""),
        "numero_partido": str(party_number or ""),
        "situacao_candidatura": str(
            first(
                row,
                "descricaoSituacao",
                "situacaoCandidato",
                "descricaoSituacaoCandidato",
                "DS_SITUACAO_CANDIDATURA",
            )
        ),
        "situacao_urna": str(
            first(row, "descricaoTotalizacao", "situacaoTotalizacao", "DS_SITUACAO_CANDIDATO_URNA")
        ),
        "genero": str(first(row, "descricaoSexo", "genero", "DS_GENERO")),
        "grau_instrucao": str(
            first(row, "grauInstrucao", "descricaoGrauInstrucao", "DS_GRAU_INSTRUCAO")
        ),
        "ocupacao": str(first(row, "ocupacao", "descricaoOcupacao", "DS_OCUPACAO")),
        "cor_raca": str(first(row, "descricaoCorRaca", "corRaca", "DS_COR_RACA")),
        "data_nascimento": normalize_date(
            first(row, "dataDeNascimento", "dataNascimento", "DT_NASCIMENTO")
        ),
        "email": str(first(row, "DS_EMAIL")),
        "foto_url": str(photo or ""),
        "ultima_atualizacao_tse": str(
            first(row, "dataUltimaAtualizacao", "DT_GERACAO")
        ),
    }


def decode_csv(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")


def collect_from_official_zip() -> tuple[list[dict[str, object]], dict[str, object]]:
    zip_path = download(CANDIDATES_ZIP_URL, RAW_ZIP_PATH)

    try:
        election_id = discover_election_id()
        log(f"ID da eleição 2026 no DivulgaCandContas: {election_id}")
    except Exception as error:
        election_id = None
        log(f"Aviso: não foi possível descobrir o ID da eleição para montar URLs de foto: {error}")

    deputies: list[dict[str, object]] = []
    csv_files = 0

    with zipfile.ZipFile(zip_path) as archive:
        names = [
            name
            for name in archive.namelist()
            if name.lower().endswith(".csv")
            and "consulta_cand_2026" in Path(name).name.lower()
        ]

        if not names:
            raise RuntimeError("O ZIP oficial não contém arquivos consulta_cand_2026*.csv.")

        for name in names:
            csv_files += 1
            raw = archive.read(name)
            reader = csv.DictReader(io.StringIO(decode_csv(raw)), delimiter=";")
            file_count = 0

            for row in reader:
                cargo_code = str(first(row, "CD_CARGO")).strip()
                cargo_name = str(first(row, "DS_CARGO")).strip().upper()
                if cargo_code != CARGO_CODE and cargo_name != "DEPUTADO FEDERAL":
                    continue

                candidate = normalize_candidate(row, election_id=election_id)
                if candidate["id_tse"] and (candidate["nome"] or candidate["nome_urna"]):
                    deputies.append(candidate)
                    file_count += 1

            if file_count:
                log(f"{Path(name).name}: {file_count} candidaturas a Deputado Federal")

    if not deputies:
        raise RuntimeError("Nenhuma candidatura a Deputado Federal foi encontrada no ZIP oficial.")

    return deputies, {
        "mode": "portal_dados_abertos_zip",
        "source_url": CANDIDATES_ZIP_URL,
        "election_id": election_id,
        "csv_files_read": csv_files,
    }


def fetch_candidates_for_uf(uf: str, election_id: int) -> list[dict[str, object]]:
    url = f"{BASE_URL}/candidatura/listar/{YEAR}/{uf}/{election_id}/{CARGO_CODE}/candidatos"
    payload = fetch_json(url)

    if isinstance(payload, dict):
        raw_candidates = payload.get("candidatos") or payload.get("candidates") or []
    elif isinstance(payload, list):
        raw_candidates = payload
    else:
        raise RuntimeError(f"Formato inesperado retornado pelo TSE para {uf}.")

    if not isinstance(raw_candidates, list):
        raise RuntimeError(f"Campo de candidatos inválido retornado pelo TSE para {uf}.")

    candidates = [
        normalize_candidate(item, uf_hint=uf, election_id=election_id)
        for item in raw_candidates
        if isinstance(item, dict)
    ]
    candidates = [
        item
        for item in candidates
        if item["id_tse"] and (item["nome"] or item["nome_urna"])
    ]
    log(f"{uf}: {len(candidates)} candidaturas")
    return candidates


def collect_from_rest() -> tuple[list[dict[str, object]], dict[str, object]]:
    log("Usando fallback REST do DivulgaCandContas...")
    election_id = discover_election_id()
    log(f"ID da eleição encontrado: {election_id}")

    deputies: list[dict[str, object]] = []
    failed: list[str] = []

    for uf in UFS:
        try:
            deputies.extend(fetch_candidates_for_uf(uf, election_id))
        except Exception as error:
            log(f"ERRO em {uf}: {error}")
            failed.append(uf)
        time.sleep(0.25)

    if failed:
        log("Repetindo as UFs que falharam uma vez...")
        still_failed: list[str] = []
        for uf in failed:
            try:
                deputies.extend(fetch_candidates_for_uf(uf, election_id))
            except Exception as error:
                log(f"ERRO definitivo em {uf}: {error}")
                still_failed.append(uf)
            time.sleep(0.5)
        failed = still_failed

    if failed:
        raise RuntimeError(
            "A coleta REST não será publicada porque houve falha nas UFs: "
            + ", ".join(failed)
        )

    return deputies, {
        "mode": "divulgacandcontas_rest",
        "source_url": BASE_URL,
        "election_id": election_id,
    }


def write_outputs(
    deputies: list[dict[str, object]],
    source_metadata: dict[str, object],
) -> None:
    unique: dict[str, dict[str, object]] = {}
    for item in deputies:
        candidate_id = str(item.get("id_tse", ""))
        if candidate_id:
            unique[candidate_id] = item

    ordered = sorted(
        unique.values(),
        key=lambda item: (
            str(item.get("uf", "")),
            str(item.get("nome_urna", "")).casefold(),
            str(item.get("id_tse", "")),
        ),
    )

    if not ordered:
        raise RuntimeError("A coleta terminou sem registros válidos; nada será publicado.")

    by_uf: dict[str, list[dict[str, object]]] = defaultdict(list)
    for item in ordered:
        by_uf[str(item.get("uf", ""))].append(item)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    UF_DIR.mkdir(parents=True, exist_ok=True)

    OUTPUT_PATH.write_text(
        json.dumps(ordered, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    for uf in UFS:
        (UF_DIR / f"{uf}.json").write_text(
            json.dumps(by_uf.get(uf, []), ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    present_ufs = [uf for uf in UFS if by_uf.get(uf)]
    metadata = {
        "source": "Tribunal Superior Eleitoral (TSE)",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "cargo": "DEPUTADO FEDERAL",
        "cargo_code": int(CARGO_CODE),
        "records": len(ordered),
        "ufs_expected": list(UFS),
        "ufs_present": present_ufs,
        "ufs_with_records": len(present_ufs),
        "output": "data/processed/deputados_federais.json",
        **source_metadata,
    }
    META_PATH.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    log("")
    log("=" * 72)
    log(f"COLETA CONCLUÍDA: {len(ordered)} candidaturas em {len(present_ufs)} UFs.")
    log(f"Arquivo nacional: {OUTPUT_PATH}")
    log(f"Tamanho: {OUTPUT_PATH.stat().st_size / 1024 / 1024:.2f} MB")
    log("=" * 72)


def main() -> int:
    log("Eleições 2026 — coletor nacional de Deputado Federal")
    log("Fonte: Tribunal Superior Eleitoral")
    log("")

    errors: list[str] = []

    try:
        deputies, source_metadata = collect_from_official_zip()
        write_outputs(deputies, source_metadata)
        return 0
    except Exception as error:
        errors.append(f"ZIP oficial: {error}")
        log(f"\nFalha pelo Portal de Dados Abertos: {error}")

    try:
        deputies, source_metadata = collect_from_rest()
        write_outputs(deputies, source_metadata)
        return 0
    except Exception as error:
        errors.append(f"REST: {error}")
        log(f"\nFalha pelo DivulgaCandContas: {error}")

    log("")
    log("Não foi possível coletar os dados por nenhuma das fontes oficiais.")
    for error in errors:
        log(f" - {error}")
    log("")
    log("Nenhum arquivo processado existente foi apagado ou substituído.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
