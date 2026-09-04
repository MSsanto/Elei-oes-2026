from __future__ import annotations

import csv
import io
import json
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import fetch_candidates as base

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = ROOT / "data" / "processed" / "candidatos"
PRESIDENT_DIR = OUTPUT_ROOT / "presidente"
GOVERNOR_DIR = OUTPUT_ROOT / "governador"

TARGETS = {
    "PRESIDENTE": {
        "slug": "presidente",
        "code": "1",
        "label": "Presidente",
    },
    "GOVERNADOR": {
        "slug": "governador",
        "code": "3",
        "label": "Governador",
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

    try:
        election_id = base.discover_election_id()
    except Exception as error:
        election_id = None
        log(f"Aviso: ID da eleição não localizado; URLs de foto podem ficar vazias: {error}")

    found: dict[str, list[dict[str, object]]] = {
        target["slug"]: [] for target in TARGETS.values()
    }
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

                candidate = base.normalize_candidate(row, election_id=election_id)
                if not candidate.get("id_tse") or not (candidate.get("nome") or candidate.get("nome_urna")):
                    continue

                candidate["cargo"] = target["label"]
                candidate["cargo_slug"] = target["slug"]
                candidate["cargo_codigo"] = cargo_code or target["code"]

                if target["slug"] == "presidente":
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

    return found, {
        "source": "Tribunal Superior Eleitoral (TSE)",
        "source_url": base.CANDIDATES_ZIP_URL,
        "election_id": election_id,
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


def publish_governor(records: list[dict[str, object]], metadata: dict[str, object]) -> dict[str, object]:
    ordered = unique_sorted(records)
    by_uf: dict[str, list[dict[str, object]]] = defaultdict(list)
    for item in ordered:
        uf = str(item.get("uf") or "").upper()
        if uf in base.UFS:
            by_uf[uf].append(item)

    uf_meta: dict[str, dict[str, object]] = {}
    for uf in base.UFS:
        payload = by_uf.get(uf, [])
        compact_json(GOVERNOR_DIR / f"{uf}.json", payload)
        uf_meta[uf] = {
            "total": len(payload),
            "arquivo": f"{uf}.json",
            "partidos": sorted({str(item.get("partido")) for item in payload if item.get("partido")}),
            "ocupacoes": sorted({str(item.get("ocupacao")) for item in payload if item.get("ocupacao")}),
        }

    manifest = {
        "cargo": "governador",
        "label": "Governador",
        "circunscricao": "estadual",
        "total": len(ordered),
        "ufs": uf_meta,
        **metadata,
    }
    pretty_json(GOVERNOR_DIR / "manifest.json", manifest)
    return manifest


def main() -> int:
    log("Eleições 2026 — geração multi-cargo: Presidente e Governador")
    targets, metadata = collect_targets()

    president_manifest = publish_president(targets.get("presidente", []), metadata)
    governor_manifest = publish_governor(targets.get("governador", []), metadata)

    root_manifest = {
        "version": 1,
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
            "deputado-federal": {
                "status": "legado_compativel",
                "arquivo": "../deputados_federais.json",
            },
        },
    }
    pretty_json(OUTPUT_ROOT / "manifest.json", root_manifest)

    log(
        "Publicação concluída: "
        f"Presidente={president_manifest['total']}; "
        f"Governador={governor_manifest['total']}"
    )
    if president_manifest["total"] == 0:
        log("Aviso: nenhuma candidatura a Presidente foi encontrada nesta carga oficial.")
    if governor_manifest["total"] == 0:
        log("Aviso: nenhuma candidatura a Governador foi encontrada nesta carga oficial.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
