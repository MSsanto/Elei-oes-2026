from __future__ import annotations

import csv
import io
import json
import shutil
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import fetch_candidates as base

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = ROOT / "data" / "processed" / "candidatos"
PRESIDENT_DIR = OUTPUT_ROOT / "presidente"
GOVERNOR_DIR = OUTPUT_ROOT / "governador"
SENATOR_DIR = OUTPUT_ROOT / "senador"
STATE_DEPUTY_DIR = OUTPUT_ROOT / "deputado-estadual"
STATE_DEPUTY_PAGE_SIZE = 60

TARGETS = {
    "PRESIDENTE": {
        "slug": "presidente",
        "code": "1",
        "label": "Presidente",
        "scope": "nacional",
    },
    "GOVERNADOR": {
        "slug": "governador",
        "code": "3",
        "label": "Governador",
        "scope": "estadual",
    },
    "SENADOR": {
        "slug": "senador",
        "code": "5",
        "label": "Senador",
        "scope": "estadual",
    },
    "DEPUTADO ESTADUAL": {
        "slug": "deputado-estadual",
        "code": "7",
        "label": "Deputado Estadual",
        "scope": "estadual",
    },
    "DEPUTADO DISTRITAL": {
        "slug": "deputado-estadual",
        "code": "8",
        "label": "Deputado Distrital",
        "scope": "estadual",
    },
}


def log(message: str) -> None:
    print(message, flush=True)


def compact_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def pretty_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def normalize_cargo_name(value: object) -> str:
    return " ".join(str(value or "").strip().upper().split())


def collect_targets() -> tuple[dict[str, list[dict[str, object]]], dict[str, object]]:
    zip_path = base.RAW_ZIP_PATH
    if not zip_path.exists():
        raise RuntimeError(
            f"ZIP oficial não encontrado em {zip_path}. Rode o coletor TSE antes deste script."
        )

    found: dict[str, list[dict[str, object]]] = {
        target["slug"]: [] for target in TARGETS.values()
    }
    csv_files = 0
    election_ids: set[str] = set()

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
            reader = csv.DictReader(
                io.StringIO(base.decode_csv(archive.read(name))),
                delimiter=";",
            )
            local_counts: dict[str, int] = defaultdict(int)

            for row in reader:
                cargo_name = normalize_cargo_name(base.first(row, "DS_CARGO"))
                cargo_code = str(base.first(row, "CD_CARGO")).strip()

                target = None
                for expected_name, config in TARGETS.items():
                    if cargo_name == expected_name or cargo_code == config["code"]:
                        target = config
                        break
                if target is None:
                    continue

                row_election_id = str(base.first(row, "SQ_ELEICAO")).strip()
                if row_election_id:
                    election_ids.add(row_election_id)

                candidate = base.normalize_candidate(
                    row,
                    election_id=row_election_id or None,
                )
                if not candidate.get("id_tse") or not (candidate.get("nome") or candidate.get("nome_urna")):
                    continue

                candidate["cargo"] = target["label"]
                candidate["cargo_slug"] = target["slug"]
                candidate["cargo_codigo"] = cargo_code or target["code"]

                if target["scope"] == "nacional":
                    candidate["uf"] = "BR"
                else:
                    uf = str(candidate.get("uf") or "").upper()
                    if uf not in base.UFS:
                        continue
                    candidate["uf"] = uf

                found[target["slug"]].append(candidate)
                local_counts[target["slug"]] += 1

            if local_counts:
                details = ", ".join(f"{slug}={count}" for slug, count in sorted(local_counts.items()))
                log(f"{Path(name).name}: {details}")

    sorted_election_ids = sorted(election_ids)
    return found, {
        "source": "Tribunal Superior Eleitoral (TSE)",
        "source_url": base.CANDIDATES_ZIP_URL,
        "election_id": sorted_election_ids[0] if len(sorted_election_ids) == 1 else None,
        "election_ids": sorted_election_ids,
        "csv_files_read": csv_files,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }


def unique_sorted(records: list[dict[str, object]]) -> list[dict[str, object]]:
    unique: dict[str, dict[str, object]] = {}
    for item in records:
        identifier = str(item.get("id_tse") or "")
        if identifier:
            unique[identifier] = item
    return sorted(
        unique.values(),
        key=lambda item: (
            str(item.get("uf") or ""),
            str(item.get("nome_urna") or item.get("nome") or "").casefold(),
            str(item.get("id_tse") or ""),
        ),
    )


def publish_president(records: list[dict[str, object]], metadata: dict[str, object]) -> dict[str, object]:
    ordered = unique_sorted(records)
    compact_json(PRESIDENT_DIR / "brasil.json", ordered)
    manifest = {
        "cargo": "presidente",
        "label": "Presidente",
        "circunscricao": "nacional",
        "total": len(ordered),
        "arquivo": "brasil.json",
        "partidos": sorted({str(item.get("partido")) for item in ordered if item.get("partido")}),
        "ocupacoes": sorted({str(item.get("ocupacao")) for item in ordered if item.get("ocupacao")}),
        **metadata,
    }
    pretty_json(PRESIDENT_DIR / "manifest.json", manifest)
    return manifest


def publish_statewide(
    records: list[dict[str, object]],
    metadata: dict[str, object],
    *,
    slug: str,
    label: str,
    output_dir: Path,
) -> dict[str, object]:
    ordered = unique_sorted(records)
    by_uf: dict[str, list[dict[str, object]]] = defaultdict(list)
    for item in ordered:
        uf = str(item.get("uf") or "").upper()
        if uf in base.UFS:
            by_uf[uf].append(item)

    uf_meta: dict[str, dict[str, object]] = {}
    for uf in base.UFS:
        payload = by_uf.get(uf, [])
        compact_json(output_dir / f"{uf}.json", payload)
        uf_meta[uf] = {
            "total": len(payload),
            "arquivo": f"{uf}.json",
            "partidos": sorted({str(item.get("partido")) for item in payload if item.get("partido")}),
            "ocupacoes": sorted({str(item.get("ocupacao")) for item in payload if item.get("ocupacao")}),
        }

    manifest = {
        "cargo": slug,
        "label": label,
        "circunscricao": "estadual",
        "total": len(ordered),
        "ufs": uf_meta,
        **metadata,
    }
    pretty_json(output_dir / "manifest.json", manifest)
    return manifest


def state_deputy_card(item: dict[str, object], page: int) -> dict[str, object]:
    return {
        "id_tse": item.get("id_tse"),
        "nome": item.get("nome"),
        "nome_urna": item.get("nome_urna"),
        "numero": item.get("numero"),
        "partido": item.get("partido"),
        "ocupacao": item.get("ocupacao"),
        "uf": item.get("uf"),
        "cargo": item.get("cargo"),
        "cargo_slug": "deputado-estadual",
        "situacao_candidatura": item.get("situacao_candidatura"),
        "foto_url": item.get("foto_url"),
        "pagina": page,
    }


def publish_state_deputies(
    records: list[dict[str, object]],
    metadata: dict[str, object],
) -> dict[str, object]:
    ordered = unique_sorted(records)
    by_uf: dict[str, list[dict[str, object]]] = defaultdict(list)
    for item in ordered:
        uf = str(item.get("uf") or "").upper()
        if uf in base.UFS:
            by_uf[uf].append(item)

    STATE_DEPUTY_DIR.mkdir(parents=True, exist_ok=True)
    uf_meta: dict[str, dict[str, object]] = {}

    for uf in base.UFS:
        payload = by_uf.get(uf, [])
        uf_dir = STATE_DEPUTY_DIR / uf
        if uf_dir.exists():
            shutil.rmtree(uf_dir)
        (uf_dir / "cards").mkdir(parents=True, exist_ok=True)
        (uf_dir / "perfis").mkdir(parents=True, exist_ok=True)

        search_index: list[dict[str, object]] = []
        page_count = (len(payload) + STATE_DEPUTY_PAGE_SIZE - 1) // STATE_DEPUTY_PAGE_SIZE

        for page_number in range(1, page_count + 1):
            start = (page_number - 1) * STATE_DEPUTY_PAGE_SIZE
            chunk = payload[start : start + STATE_DEPUTY_PAGE_SIZE]
            cards = [state_deputy_card(item, page_number) for item in chunk]
            search_index.extend(cards)
            compact_json(uf_dir / "cards" / f"{page_number:03d}.json", cards)
            compact_json(uf_dir / "perfis" / f"{page_number:03d}.json", chunk)

        compact_json(uf_dir / "search-index.json", search_index)
        label = "Deputado Distrital" if uf == "DF" else "Deputado Estadual"
        manifest = {
            "cargo": "deputado-estadual",
            "label": label,
            "circunscricao": "distrital" if uf == "DF" else "estadual",
            "uf": uf,
            "total": len(payload),
            "page_size": STATE_DEPUTY_PAGE_SIZE,
            "page_count": page_count,
            "cards_pattern": "cards/{page:03d}.json",
            "profiles_pattern": "perfis/{page:03d}.json",
            "search_index": "search-index.json",
            "partidos": sorted({str(item.get("partido")) for item in payload if item.get("partido")}),
            "ocupacoes": sorted({str(item.get("ocupacao")) for item in payload if item.get("ocupacao")}),
            **metadata,
        }
        pretty_json(uf_dir / "manifest.json", manifest)
        uf_meta[uf] = {
            "total": len(payload),
            "page_count": page_count,
            "manifest": f"{uf}/manifest.json",
            "label": label,
        }

    root_manifest = {
        "cargo": "deputado-estadual",
        "label": "Deputado Estadual/Distrital",
        "circunscricao": "estadual",
        "total": len(ordered),
        "page_size": STATE_DEPUTY_PAGE_SIZE,
        "estrategia": "uf_obrigatoria_paginas_e_indice_sob_demanda",
        "ufs": uf_meta,
        **metadata,
    }
    pretty_json(STATE_DEPUTY_DIR / "manifest.json", root_manifest)
    return root_manifest


def main() -> int:
    log("Eleições 2026 — geração multi-cargo: Presidente, Governador, Senador e Deputado Estadual/Distrital")
    targets, metadata = collect_targets()

    president_manifest = publish_president(targets.get("presidente", []), metadata)
    governor_manifest = publish_statewide(
        targets.get("governador", []),
        metadata,
        slug="governador",
        label="Governador",
        output_dir=GOVERNOR_DIR,
    )
    senator_manifest = publish_statewide(
        targets.get("senador", []),
        metadata,
        slug="senador",
        label="Senador",
        output_dir=SENATOR_DIR,
    )
    state_deputy_manifest = publish_state_deputies(
        targets.get("deputado-estadual", []),
        metadata,
    )

    root_manifest = {
        "version": 3,
        "generated_at_utc": metadata["generated_at_utc"],
        "source": metadata["source"],
        "cargos": {
            "presidente": {
                "total": president_manifest["total"],
                "manifest": "presidente/manifest.json",
            },
            "governador": {
                "total": governor_manifest["total"],
                "manifest": "governador/manifest.json",
            },
            "senador": {
                "total": senator_manifest["total"],
                "manifest": "senador/manifest.json",
                "historico_senado": "pendente",
            },
            "deputado-federal": {
                "status": "legado_compativel",
                "arquivo": "../deputados_federais.json",
            },
            "deputado-estadual": {
                "total": state_deputy_manifest["total"],
                "manifest": "deputado-estadual/manifest.json",
                "carregamento": "uf_obrigatoria_paginas_e_indice_sob_demanda",
            },
        },
    }
    pretty_json(OUTPUT_ROOT / "manifest.json", root_manifest)

    log(
        "Publicação concluída: "
        f"Presidente={president_manifest['total']}; "
        f"Governador={governor_manifest['total']}; "
        f"Senador={senator_manifest['total']}; "
        f"Deputado Estadual/Distrital={state_deputy_manifest['total']}"
    )
    for slug, manifest in (
        ("Presidente", president_manifest),
        ("Governador", governor_manifest),
        ("Senador", senator_manifest),
        ("Deputado Estadual/Distrital", state_deputy_manifest),
    ):
        if manifest["total"] == 0:
            log(f"Aviso: nenhuma candidatura a {slug} foi encontrada nesta carga oficial.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
