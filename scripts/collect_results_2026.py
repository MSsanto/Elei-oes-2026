#!/usr/bin/env python3
"""Consolida resultado eleitoral oficial de 2026 por SQ_CANDIDATO.

Executar somente quando houver autorização para atualizar o arquivo do ciclo 2026.
As páginas do TSE são fonte factual; status de registro NÃO é resultado eleitoral.
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data/processed/resultados-2026/status-por-candidato.json"
TSE = "https://resultados.tse.jus.br/oficial/ele2026"
UFS = (
    "ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg",
    "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "sp", "se", "to",
)


def requests_plan():
    """(eleição, cargo, uf). 2º turno substitui 1º para Presidente/Governador."""
    tasks = [(6257, 1, "br", "presidente")]
    for uf in UFS:
        tasks.extend((
            (6259, 3, uf, "governador"),
            (6259, 5, uf, "senador"),
            (6259, 6, uf, "deputado-federal"),
            (6259, 7 if uf != "df" else 8, uf, "deputado-estadual"),
        ))
    # Distrito Federal também tem eleição própria de conselheiro distrital.
    # Deputado distrital consta no cargo 8: a ausência deste recurso não será
    # confundida com 2º turno nem transformada em status de derrota.
    tasks.extend(((6258, 1, "br", "presidente"),))
    tasks.extend((6260, 3, uf, "governador") for uf in UFS)
    return tasks


def resource_url(election: int, cargo: int, uf: str) -> str:
    """Nomes/códigos seguem o layout documentado de resultados do TSE."""
    return f"{TSE}/{election}/dados/{uf}/{uf}-c{cargo:04d}-e{election:06d}-u.json"


def normalized(text: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFKD", str(text or ""))
                   if not unicodedata.combining(ch)).strip().casefold()


def election_outcome(candidate: dict):
    """Nunca tratar ausência de dado ou 2º turno em aberto como 'Não eleito'."""
    description = normalized(candidate.get("st", ""))
    elected_flag = candidate.get("e", "").strip().lower()
    if elected_flag == "s" and description.startswith("eleito"):
        return "eleito"
    if description.startswith("eleito"):
        return "eleito"
    if description in ("nao eleito", "suplente", "nao eleito por qp", "nao eleito por media"):
        return "nao_eleito"
    return None


def final_count(data: dict) -> bool:
    """Só publica status de escopo totalizado; não interpreta resultados parciais."""
    if not isinstance(data, dict):
        return False
    progress = data.get("s") if isinstance(data.get("s"), dict) else {}
    return (str(progress.get("pst", "")).replace(",", ".") in ("100", "100.0", "100.00")
            and str(data.get("and", "")).lower() == "f")


def candidate_nodes(tree):
    """Percorre resultados agregados e ignora vices (vs)."""
    if isinstance(tree, list):
        for item in tree:
            yield from candidate_nodes(item)
    elif isinstance(tree, dict):
        if isinstance(tree.get("cand"), list):
            for candidate in tree["cand"]:
                if isinstance(candidate, dict) and candidate.get("sqcand"):
                    yield candidate
        for key, value in tree.items():
            if key not in ("cand", "vs"):
                yield from candidate_nodes(value)


def parse_results(data: dict, election: int, cargo: int, uf: str, slug: str) -> dict:
    if not final_count(data):
        raise ValueError(f"Totalização ainda não concluída: {election}, {cargo}, {uf}")
    records = {}
    for candidate in candidate_nodes(data.get("carg", [])):
        sqcand = str(candidate["sqcand"])
        if not sqcand.isdecimal():
            continue
        outcome = election_outcome(candidate)
        if not outcome:
            continue
        records[sqcand] = {
            "situacao": outcome,
            "detalhe": str(candidate.get("st") or ("Eleito" if outcome == "eleito" else "Não eleito")),
            "cargo": slug,
            "uf": uf.upper(),
            "eleicao": str(election),
        }
    if not records:
        raise ValueError(f"Resposta sem situações eleitorais conclusivas: {election}, {cargo}, {uf}")
    return records


def fetch_json(url: str, attempts: int = 2):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "TransparenciaEleitoral/2026 (+https://github.com/MSsanto/Elei-oes-2026)",
                 "Accept": "application/json", "Accept-Encoding": "identity"},
    )
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=28) as response:
                return json.load(response)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            if attempt + 1 >= attempts:
                raise
            time.sleep(1 + attempt)


def collect(output: Path, min_success: int = 1) -> dict:
    records = {}
    ok = []
    errors = []
    # Ordem: primeiro turno, depois segundo turno (prevalece para candidatos da segunda rodada).
    for election, cargo, uf, slug in requests_plan():
        url = resource_url(election, cargo, uf)
        try:
            data = fetch_json(url)
            parsed = parse_results(data, election, cargo, uf, slug)
            records.update(parsed)
            ok.append({"eleicao": election, "cargo": slug, "uf": uf.upper(),
                       "total_candidaturas": len(parsed), "url": url,
                       "gerado_em": f"{data.get('dg', '')} {data.get('hg', '')}".strip()})
            logging.info("OK %s, %s, %s: %d registros", election, slug, uf, len(parsed))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as error:
            errors.append({"eleicao": election, "cargo": slug, "uf": uf.upper(),
                           "erro": str(error)[:160], "url": url})
            logging.warning("Ignorado %s: %s", url, error)
        time.sleep(0.15)
    if len(ok) < min_success:
        raise RuntimeError(f"Apenas {len(ok)} arquivos válidos (mínimo {min_success}). Nenhum dado será substituído.")
    if len(records) < 2:
        raise RuntimeError("O TSE não forneceu resultados suficientes para gerar o arquivo.")
    existing = {}
    if output.exists():
        try:
            existing = json.loads(output.read_text(encoding="utf-8")).get("candidaturas", {})
        except (ValueError, OSError):
            existing = {}
    # Preserva valores já confirmados quando a fonte falhar nesta execução.
    # O documento registra a cobertura para não ocultar o escopo da coleta.
    existing.update(records)
    payload = {
        "schema_version": 1,
        "fonte": "TSE - Resultados oficiais 2026",
        "fonte_url": "https://resultados.tse.jus.br/",
        "atualizado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cobertura": {
            "arquivos_confirmados": len(ok),
            "arquivos_com_falhas_ou_pendentes": len(errors),
            "total_candidaturas_confirmadas": len(existing),
            "arquivos": ok,
            "pendencias": errors,
        },
        "candidaturas": dict(sorted(existing.items())),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--min-success", type=int, default=30)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    payload = collect(args.output, min_success=args.min_success)
    print(f"Resultados do TSE consolidados: {len(payload['candidaturas'])} candidaturas; "
          f"{payload['cobertura']['arquivos_confirmados']} fontes confirmadas.")


if __name__ == "__main__":
    main()
