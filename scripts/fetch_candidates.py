from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

YEAR = 2026
CARGO_CODE = 6  # Deputado Federal
BASE_URL = "https://divulgacandcontas.tse.jus.br/divulga/rest/v1"
ELECTIONS_URL = f"{BASE_URL}/eleicao/ordinarias"
UFS = (
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT",
    "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO",
    "RR", "SC", "SP", "SE", "TO",
)

ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = ROOT / "data" / "processed"
OUTPUT_PATH = PROCESSED_DIR / "deputados_federais.json"
META_PATH = PROCESSED_DIR / "metadata.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/152.0 Safari/537.36 Eleicoes-2026-Transparencia/0.2",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://divulgacandcontas.tse.jus.br/",
}


def fetch_json(url: str, attempts: int = 4) -> object:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        request = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            if attempt == attempts:
                break
            wait = attempt * 2
            print(f"Tentativa {attempt} falhou para {url}: {error}. Nova tentativa em {wait}s.")
            time.sleep(wait)
    raise RuntimeError(f"Falha ao consultar {url}: {last_error}")


def discover_election_id() -> int:
    elections = fetch_json(ELECTIONS_URL)
    if not isinstance(elections, list):
        raise RuntimeError("Resposta inesperada ao consultar as eleições ordinárias do TSE.")

    for election in elections:
        if isinstance(election, dict) and election.get("ano") == YEAR:
            election_id = election.get("id")
            if election_id:
                return int(election_id)

    raise RuntimeError(f"Eleição ordinária de {YEAR} não encontrada no DivulgaCandContas.")


def epoch_ms_to_date(value: object) -> str:
    if value in (None, ""):
        return ""
    try:
        milliseconds = int(value)
        return datetime.fromtimestamp(milliseconds / 1000, tz=timezone.utc).strftime("%d/%m/%Y")
    except (TypeError, ValueError, OSError):
        return str(value)


def epoch_ms_to_iso(value: object) -> str:
    if value in (None, ""):
        return ""
    try:
        milliseconds = int(value)
        return datetime.fromtimestamp(milliseconds / 1000, tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return str(value)


def normalize_candidate(candidate: dict[str, object], uf: str, election_id: int) -> dict[str, object]:
    party = candidate.get("partido") if isinstance(candidate.get("partido"), dict) else {}
    candidate_id = candidate.get("id") or candidate.get("sq_CANDIDATO")
    number = candidate.get("numero") or candidate.get("nr_CANDIDATO")
    name = candidate.get("nomeCompleto") or candidate.get("nm_CANDIDATO") or ""
    ballot_name = candidate.get("nomeUrna") or candidate.get("nm_URNA") or name
    party_sigla = party.get("sigla") or candidate.get("sg_PARTIDO") or ""
    party_number = party.get("numero") or ""

    photo_url = candidate.get("fotoUrl") or (
        f"https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/"
        f"{election_id}/{candidate_id}/{uf}"
        if candidate_id else ""
    )

    return {
        "ano_eleicao": str(YEAR),
        "uf": candidate.get("ufCandidatura") or uf,
        "id_tse": str(candidate_id or ""),
        "numero": str(number or ""),
        "nome": str(name),
        "nome_urna": str(ballot_name),
        "partido": str(party_sigla),
        "numero_partido": str(party_number),
        "situacao_candidatura": str(candidate.get("descricaoSituacao") or candidate.get("situacaoCandidato") or ""),
        "situacao_urna": str(candidate.get("descricaoTotalizacao") or ""),
        "genero": str(candidate.get("descricaoSexo") or ""),
        "grau_instrucao": str(candidate.get("grauInstrucao") or ""),
        "ocupacao": str(candidate.get("ocupacao") or ""),
        "cor_raca": str(candidate.get("descricaoCorRaca") or ""),
        "data_nascimento": epoch_ms_to_date(candidate.get("dataDeNascimento")),
        "email": "",
        "foto_url": str(photo_url),
        "ultima_atualizacao_tse": epoch_ms_to_iso(candidate.get("dataUltimaAtualizacao")),
    }


def fetch_candidates_for_uf(uf: str, election_id: int) -> list[dict[str, object]]:
    url = f"{BASE_URL}/candidatura/listar/{YEAR}/{uf}/{election_id}/{CARGO_CODE}/candidatos"
    payload = fetch_json(url)

    if isinstance(payload, dict):
        raw_candidates = payload.get("candidatos", [])
    elif isinstance(payload, list):
        raw_candidates = payload
    else:
        raise RuntimeError(f"Formato inesperado retornado pelo TSE para {uf}.")

    if not isinstance(raw_candidates, list):
        raise RuntimeError(f"Campo 'candidatos' inválido retornado pelo TSE para {uf}.")

    candidates = [
        normalize_candidate(item, uf, election_id)
        for item in raw_candidates
        if isinstance(item, dict)
    ]
    print(f"{uf}: {len(candidates)} candidaturas a Deputado Federal")
    return candidates


def main() -> None:
    print("Consultando eleição 2026 no DivulgaCandContas/TSE...")
    election_id = discover_election_id()
    print(f"ID da eleição encontrado: {election_id}")

    deputies: list[dict[str, object]] = []
    failed_ufs: list[str] = []

    for uf in UFS:
        try:
            deputies.extend(fetch_candidates_for_uf(uf, election_id))
        except Exception as error:  # Mantém diagnóstico por UF no job.
            print(f"ERRO em {uf}: {error}")
            failed_ufs.append(uf)
        time.sleep(0.15)

    if failed_ufs:
        raise RuntimeError(
            "A coleta não foi publicada porque houve falha nas UFs: " + ", ".join(failed_ufs)
        )

    unique = {str(item["id_tse"]): item for item in deputies if item.get("id_tse")}
    deputies = sorted(
        unique.values(),
        key=lambda item: (str(item.get("uf", "")), str(item.get("nome_urna", "")), str(item.get("id_tse", ""))),
    )

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(deputies, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    metadata = {
        "source": "Tribunal Superior Eleitoral — DivulgaCandContas",
        "source_base_url": BASE_URL,
        "source_elections_url": ELECTIONS_URL,
        "election_id": election_id,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "cargo": "DEPUTADO FEDERAL",
        "cargo_code": CARGO_CODE,
        "records": len(deputies),
        "ufs": list(UFS),
        "output": str(OUTPUT_PATH.relative_to(ROOT)).replace("\\", "/"),
    }
    META_PATH.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Concluído: {len(deputies)} candidaturas salvas em {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
