#!/usr/bin/env python3
"""Acrescenta votos nominais oficiais ao snapshot histórico, sem alterar resultados.

Fonte: arquivos unificados de totalização final (campo cand.vap), TSE 2026.
Só utiliza arquivos já registrados e homologados no snapshot de encerramento.
"""
from __future__ import annotations

import argparse
import copy
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from collect_results_2026 import DEFAULT_OUTPUT, candidate_nodes, fetch_json, final_count, election_outcome

OFFICIAL_HOST = "resultados.tse.jus.br"
YEAR_PREFIX = "/oficial/ele2026/"
MIN_COVERAGE_RATIO = 0.995


def validated_votes(raw):
    """Votos nominais inteiros; nada de inferir a partir de percentuais."""
    if isinstance(raw, bool):
        return None
    value = str(raw).strip() if raw is not None else ""
    if not re.fullmatch(r"\d{1,12}", value):
        return None
    count = int(value)
    return count if count <= 300_000_000 else None


def scope_key(record):
    return str(record.get("eleicao", "")), str(record.get("cargo", "")), str(record.get("uf", "")).upper()


def parse_vote_source(source_meta, data):
    """Lê votos por SQ_CANDIDATO de uma totalização integral já registrada."""
    if not final_count(data):
        raise ValueError("Fonte deixou de indicar totalização final.")
    entries = {}
    election = str(source_meta["eleicao"])
    cargo = str(source_meta["cargo"])
    uf = str(source_meta["uf"]).upper()
    round_number = 2 if int(election) in (6258, 6260) else 1
    for item in candidate_nodes(data.get("carg", [])):
        identifier = str(item.get("sqcand", ""))
        if not identifier.isdecimal():
            continue
        votes = validated_votes(item.get("vap"))
        status = election_outcome(item)
        if votes is None or status is None:
            continue
        entries[identifier] = {
            "votos": votes,
            "turno": round_number,
            "situacao": status,
            "eleicao": election,
            "cargo": cargo,
            "uf": uf,
        }
    if not entries:
        raise ValueError("Nenhuma votação nominal conclusiva foi localizada.")
    return entries


def apply_votes(snapshot, by_candidate, *, min_coverage=MIN_COVERAGE_RATIO):
    """Copia dados de votos, mas NUNCA troca os campos de resultado existentes."""
    updated = copy.deepcopy(snapshot)
    records = updated["candidaturas"]
    matched = 0
    mismatched = []
    missing = []
    for identifier, record in records.items():
        fresh = by_candidate.get(identifier)
        if fresh is None:
            missing.append(identifier)
            continue
        if scope_key(fresh) != scope_key(record) or fresh["situacao"] != record["situacao"]:
            mismatched.append(identifier)
            continue
        record["votos"] = fresh["votos"]
        record["turno"] = fresh["turno"]
        matched += 1
    if mismatched:
        raise ValueError(f"{len(mismatched)} divergência(s) entre a situação congelada e o TSE; primeira: {mismatched[0]}. Sem gravação.")
    fraction = matched / max(len(records), 1)
    if fraction < min_coverage:
        raise ValueError(f"Cobertura de votos insuficiente ({matched}/{len(records)}, {fraction:.2%}); sem gravação.")
    updated["votos_fonte"] = "TSE - Resultados oficiais 2026 (cand.vap)"
    updated["votos_atualizados_em"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    updated["votos_cobertura"] = {"candidaturas_com_votos": matched,
                                  "candidaturas_na_base": len(records),
                                  "sem_votos_confirmados": len(missing)}
    return updated


def enrich(path: Path, *, min_coverage=MIN_COVERAGE_RATIO):
    original = json.loads(path.read_text(encoding="utf-8"))
    if original.get("fonte") != "TSE - Resultados oficiais 2026":
        raise ValueError("Snapshot de fonte diferente do TSE. Abortado.")
    if len(original.get("candidaturas", {})) < 18000:
        raise ValueError("Snapshot oficial incompleto. Abortado.")
    files = original.get("cobertura", {}).get("arquivos", [])
    if len(files) < 116:
        raise ValueError("Cobertura congelada não contém os 116 arquivos validados. Abortado.")
    collected = {}
    for meta in files:
        url = str(meta.get("url") or "")
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname != OFFICIAL_HOST or not parsed.path.startswith(YEAR_PREFIX):
            raise ValueError("Fonte fora do domínio oficial esperado. Abortado.")
        document = fetch_json(url)
        extracted = parse_vote_source(meta, document)
        for identifier, vote in extracted.items():
            # Apenas a totalização da rodada/circunscrição anotada no snapshot
            # pode fornecer os votos usados na interface.
            frozen = original["candidaturas"].get(identifier)
            if frozen and scope_key(frozen) == scope_key(vote):
                collected[identifier] = vote
        logging.info("Fonte de votos verificada: %s (%d candidatos)", url, len(extracted))
    updated = apply_votes(original, collected, min_coverage=min_coverage)
    path.write_text(json.dumps(updated, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return updated


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    data = enrich(args.path)
    coverage = data["votos_cobertura"]
    print("Votos oficiais associados: {}/{} candidaturas; sem correspondência: {}."
          .format(coverage["candidaturas_com_votos"], coverage["candidaturas_na_base"],
                  coverage["sem_votos_confirmados"]))
