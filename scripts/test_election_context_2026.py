#!/usr/bin/env python3
"""Testes offline do contexto eleitoral 2026.

Não acessa rede. Exercita parser, validações estruturais e cálculo da razão
candidaturas/vaga com ZIPs sintéticos no mesmo formato lógico esperado do TSE.
"""

from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path

import build_election_context_2026 as context

FEDERAL_SEATS = {
    "AC": 8, "AL": 9, "AP": 8, "AM": 8, "BA": 39, "CE": 22, "DF": 8,
    "ES": 10, "GO": 17, "MA": 18, "MT": 8, "MS": 8, "MG": 53, "PA": 17,
    "PB": 12, "PR": 30, "PE": 25, "PI": 10, "RJ": 46, "RN": 8, "RS": 31,
    "RO": 8, "RR": 8, "SC": 16, "SP": 70, "SE": 8, "TO": 8,
}


def state_seats(uf: str, federal: int) -> int:
    if uf == "DF":
        return 24
    if federal <= 12:
        return federal * 3
    return 36 + (federal - 12)


def make_zip(path: Path, filename: str, content: str) -> None:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(filename, content.encode("utf-8"))


def build_seats_csv() -> str:
    rows = ["ANO_ELEICAO;SG_UF;SG_UE;DS_CARGO;QT_VAGAS;CD_ELEICAO;NR_TURNO;DT_GERACAO;HH_GERACAO"]
    rows.append("2026;BR;BR;PRESIDENTE;1;1;1;08/09/2026;20:00:00")
    for uf in context.UFS:
        rows.append(f"2026;{uf};{uf};GOVERNADOR;1;1;1;08/09/2026;20:00:00")
        rows.append(f"2026;{uf};{uf};SENADOR;2;1;1;08/09/2026;20:00:00")
        rows.append(f"2026;{uf};{uf};DEPUTADO FEDERAL;{FEDERAL_SEATS[uf]};1;1;08/09/2026;20:00:00")
        cargo = "DEPUTADO DISTRITAL" if uf == "DF" else "DEPUTADO ESTADUAL"
        rows.append(f"2026;{uf};{uf};{cargo};{state_seats(uf, FEDERAL_SEATS[uf])};1;1;08/09/2026;20:00:00")
    return "\n".join(rows) + "\n"


def build_electorate_csv() -> str:
    rows = ["ANO_ELEICAO;SG_UF;QT_ELEITORES_PERFIL;DT_GERACAO;HH_GERACAO"]
    for uf in context.UFS:
        rows.append(f"2026;{uf};5800000;08/09/2026;20:00:00")
    rows.append("2026;ZZ;900000;08/09/2026;20:00:00")
    return "\n".join(rows) + "\n"


def test_math() -> None:
    assert context.ratio(120, 10) == 12.0
    assert context.ratio(7, 2) == 3.5
    assert context.ratio(1, 0) is None
    assert context.as_int("1.059") == 1059
    assert context.as_int("54") == 54


def test_validate_seats() -> None:
    valid = {
        "presidente": {"BR": 1},
        "governador": {"BR": 27},
        "senador": {"BR": 54},
        "deputado-federal": {"BR": 513},
        "deputado-estadual": {"BR": 1059, "DF": 24},
    }
    context.validate_seats(valid)
    invalid = {key: dict(value) for key, value in valid.items()}
    invalid["senador"]["BR"] = 53
    try:
        context.validate_seats(invalid)
    except ValueError as error:
        assert "senador" in str(error)
    else:
        raise AssertionError("validate_seats deveria rejeitar total nacional incorreto")


def test_offline_sources() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        vagas = temp / "consulta_vagas_2026.zip"
        eleitorado = temp / "perfil_eleitorado_2026.zip"
        make_zip(vagas, "consulta_vagas_2026.csv", build_seats_csv())
        make_zip(eleitorado, "perfil_eleitorado_2026.csv", build_electorate_csv())

        original_vagas = context.RAW_VAGAS_ZIP
        original_eleitorado = context.RAW_ELEITORADO_ZIP
        context.RAW_VAGAS_ZIP = vagas
        context.RAW_ELEITORADO_ZIP = eleitorado
        try:
            seats, seats_source = context.load_seats()
            electorate, electorate_source = context.load_electorate()
        finally:
            context.RAW_VAGAS_ZIP = original_vagas
            context.RAW_ELEITORADO_ZIP = original_eleitorado

        assert seats["presidente"]["BR"] == 1
        assert seats["governador"]["BR"] == 27
        assert seats["senador"]["BR"] == 54
        assert seats["deputado-federal"]["BR"] == 513
        assert seats["deputado-estadual"]["BR"] == 1059
        assert seats["deputado-estadual"]["DF"] == 24
        assert len(electorate) >= 28
        assert electorate["BR"] == (27 * 5_800_000) + 900_000
        assert seats_source["file"] == "consulta_vagas_2026.csv"
        assert electorate_source["file"] == "perfil_eleitorado_2026.csv"


def main() -> None:
    assert sum(FEDERAL_SEATS.values()) == 513
    assert sum(state_seats(uf, seats) for uf, seats in FEDERAL_SEATS.items()) == 1059
    test_math()
    test_validate_seats()
    test_offline_sources()
    print("OK: contexto eleitoral 2026 validado offline")


if __name__ == "__main__":
    main()
