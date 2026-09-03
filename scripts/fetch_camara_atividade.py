#!/usr/bin/env python3
"""Coleta atividade factual da Camara para vinculos TSE-Camara confirmados.

Escopo inicial: ano de 2026.
- despesas de exercicio parlamentar: API /deputados/{id}/despesas;
- proposicoes com autoria publicada: API /proposicoes?idDeputadoAutor={id};
- votos nominais/posicionamentos registrados: arquivo oficial votacoesVotos-2026.csv;
- descricao das votacoes: arquivo oficial votacoes-2026.csv.

O script grava um JSON pequeno por parlamentar em data/processed/camara/perfis/.
Nao calcula ranking, nota ou avaliacao politica.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import shutil
import time
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = "https://dadosabertos.camara.leg.br/api/v2"
ROOT = Path(__file__).resolve().parents[1]
MAP_FILE = ROOT / "data" / "processed" / "mappings" / "identidades.json"
HISTORY_FILE = ROOT / "data" / "processed" / "camara" / "historico_confirmados.json"
OUT_DIR = ROOT / "data" / "processed" / "camara" / "perfis"
META_FILE = ROOT / "data" / "processed" / "camara" / "atividade_metadata.json"
CACHE_DIR = ROOT / ".collector" / "cache" / "camara_atividade"
USER_AGENT = "Eleicoes-2026-Transparencia/0.4 (+https://github.com/MSsanto/Elei-oes-2026)"

VOTES_URL = "https://dadosabertos.camara.leg.br/arquivos/votacoesVotos/csv/votacoesVotos-{ano}.csv"
VOTATIONS_URL = "https://dadosabertos.camara.leg.br/arquivos/votacoes/csv/votacoes-{ano}.csv"


def request_json(path: str, params: dict | None = None) -> dict:
    url = f"{BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def api_all(path: str, params: dict | None = None) -> list[dict]:
    query = dict(params or {})
    query.setdefault("itens", 100)
    query.setdefault("pagina", 1)
    records: list[dict] = []

    while True:
        payload = request_json(path, query)
        data = payload.get("dados") or []
        if not isinstance(data, list):
            break
        records.extend(data)
        links = payload.get("links") or []
        has_next = any(item.get("rel") == "next" for item in links if isinstance(item, dict))
        if not has_next or not data:
            break
        query["pagina"] += 1
    return records


def load_json(path: Path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_key(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]", "", text.lower())


def row_value(row: dict, *names: str):
    normalized = {normalize_key(key): value for key, value in row.items()}
    for name in names:
        value = normalized.get(normalize_key(name))
        if value not in (None, ""):
            return value
    return None


def parse_number(value) -> float:
    if value in (None, ""):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace("R$", "").replace(" ", "")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def cached_download(url: str, filename: str, max_age_hours: int) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / filename
    if target.exists():
        age = datetime.now(timezone.utc) - datetime.fromtimestamp(target.stat().st_mtime, timezone.utc)
        if age < timedelta(hours=max_age_hours):
            return target

    temp = target.with_suffix(target.suffix + ".tmp")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/csv,*/*"})
    with urllib.request.urlopen(request, timeout=180) as response, temp.open("wb") as output:
        shutil.copyfileobj(response, output)
    temp.replace(target)
    return target


def read_csv(path: Path):
    raw = path.read_bytes()

    # O modulo csv exige newline="" para preservar corretamente CR/LF e
    # quebras de linha dentro de campos citados. TextIOWrapper sobre BytesIO
    # reproduz a abertura recomendada para arquivos CSV.
    stream = io.TextIOWrapper(
        io.BytesIO(raw),
        encoding="utf-8-sig",
        errors="replace",
        newline="",
    )
    try:
        sample = stream.read(8192)
        stream.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=";,\t")
        except csv.Error:
            dialect = csv.excel
            dialect.delimiter = ";"

        return list(csv.DictReader(stream, dialect=dialect))
    finally:
        stream.close()


def confirmed_ids(mapping: dict) -> list[str]:
    ids = set()
    for item in mapping.get("records") or []:
        values = item.get("camara_id_deputado") or []
        if item.get("correspondencia_status") == "confirmada" and len(values) == 1:
            ids.add(str(values[0]))
    return sorted(ids, key=lambda value: int(value) if value.isdigit() else value)


def build_votes_index(ids: set[str], ano: int, max_age_hours: int) -> dict[str, list[dict]]:
    votes_file = cached_download(VOTES_URL.format(ano=ano), f"votacoesVotos-{ano}.csv", max_age_hours)
    votations_file = cached_download(VOTATIONS_URL.format(ano=ano), f"votacoes-{ano}.csv", max_age_hours)

    votations: dict[str, dict] = {}
    for row in read_csv(votations_file):
        vote_id = str(row_value(row, "id", "idVotacao") or "")
        if not vote_id:
            continue
        votations[vote_id] = {
            "id_votacao": vote_id,
            "data": row_value(row, "data"),
            "data_hora_registro": row_value(row, "dataHoraRegistro"),
            "descricao": row_value(row, "descricao"),
            "aprovacao": row_value(row, "aprovacao"),
            "sigla_orgao": row_value(row, "siglaOrgao"),
            "uri": row_value(row, "uri"),
        }

    by_deputy: dict[str, list[dict]] = {deputy_id: [] for deputy_id in ids}
    for row in read_csv(votes_file):
        deputy_id = str(row_value(row, "deputado_id", "idDeputado", "deputadoId") or "")
        if deputy_id not in ids:
            continue
        vote_id = str(row_value(row, "idVotacao", "votacao_id", "id") or "")
        metadata = votations.get(vote_id, {})
        by_deputy[deputy_id].append(
            {
                "id_votacao": vote_id,
                "voto": row_value(row, "voto"),
                "data_hora_voto": row_value(row, "dataHoraVoto"),
                "data": metadata.get("data"),
                "descricao": metadata.get("descricao"),
                "aprovacao": metadata.get("aprovacao"),
                "sigla_orgao": metadata.get("sigla_orgao"),
                "fonte_url": f"{BASE}/votacoes/{urllib.parse.quote(vote_id)}" if vote_id else None,
            }
        )

    for deputy_id in by_deputy:
        by_deputy[deputy_id].sort(
            key=lambda item: str(item.get("data_hora_voto") or item.get("data") or ""), reverse=True
        )
    return by_deputy


def profile_fresh(path: Path, max_age_hours: int) -> bool:
    if not path.exists():
        return False
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        stamp = payload.get("generated_at_utc")
        if not stamp:
            return False
        generated = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) - generated < timedelta(hours=max_age_hours)
    except Exception:
        return False


def collect_one(deputy_id: str, ano: int, votes: list[dict], history_payload: dict, delay: float) -> tuple[str, dict]:
    # Mantemos somente parametros basicos na API de despesas e ordenamos localmente.
    # Isso evita depender de campos de ordenacao que podem variar entre versoes.
    expenses = api_all(
        f"/deputados/{deputy_id}/despesas",
        {"ano": ano, "itens": 100},
    )
    expenses.sort(key=lambda item: str(item.get("dataDocumento") or ""), reverse=True)
    time.sleep(delay)

    propositions = api_all(
        "/proposicoes",
        {
            "idDeputadoAutor": deputy_id,
            "dataApresentacaoInicio": f"{ano}-01-01",
            "dataApresentacaoFim": f"{ano}-12-31",
            "ordem": "DESC",
            "ordenarPor": "id",
            "itens": 100,
        },
    )
    time.sleep(delay)

    total_liquido = sum(parse_number(item.get("valorLiquido")) for item in expenses)
    if not total_liquido and expenses:
        total_liquido = sum(parse_number(item.get("valorDocumento")) for item in expenses)

    clean_expenses = []
    for item in expenses[:40]:
        clean_expenses.append(
            {
                "ano": item.get("ano"),
                "mes": item.get("mes"),
                "tipo_despesa": item.get("tipoDespesa"),
                "data_documento": item.get("dataDocumento"),
                "numero_documento": item.get("numDocumento"),
                "fornecedor": item.get("nomeFornecedor"),
                "cnpj_cpf_fornecedor": item.get("cnpjCpfFornecedor"),
                "valor_documento": item.get("valorDocumento"),
                "valor_liquido": item.get("valorLiquido"),
                "url_documento": item.get("urlDocumento"),
            }
        )

    clean_propositions = []
    for item in propositions[:40]:
        clean_propositions.append(
            {
                "id": item.get("id"),
                "sigla_tipo": item.get("siglaTipo"),
                "numero": item.get("numero"),
                "ano": item.get("ano"),
                "ementa": item.get("ementa"),
                "uri": item.get("uri"),
            }
        )

    history = (history_payload.get("deputados") or {}).get(deputy_id) or {}
    detail = history.get("detalhe") or {}
    if isinstance(detail, list):
        detail = detail[0] if detail else {}

    return deputy_id, {
        "camara_id_deputado": deputy_id,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "periodo": {"ano": ano},
        "mandato": {
            "detalhe": detail,
            "historico": history.get("historico") or [],
            "fonte_url": f"{BASE}/deputados/{deputy_id}/historico",
        },
        "despesas": {
            "ano": ano,
            "quantidade_registros": len(expenses),
            "valor_liquido_total": round(total_liquido, 2),
            "registros_recentes": clean_expenses,
            "fonte_url": f"{BASE}/deputados/{deputy_id}/despesas?ano={ano}",
        },
        "proposicoes": {
            "ano": ano,
            "quantidade_registros": len(propositions),
            "registros_recentes": clean_propositions,
            "fonte_url": f"{BASE}/proposicoes?idDeputadoAutor={deputy_id}",
            "nota_metodologica": "A Câmara considera autores todos os signatários publicados da proposição.",
        },
        "votacoes": {
            "ano": ano,
            "quantidade_registros": len(votes),
            "registros_recentes": votes[:60],
            "fonte_url": VOTES_URL.format(ano=ano),
            "nota_metodologica": "Os registros individuais são especialmente relevantes em votações nominais; a fonte também pode conter manifestações registradas em algumas votações simbólicas.",
        },
        "fontes": [
            "Câmara dos Deputados - Dados Abertos API v2",
            f"votacoesVotos-{ano}.csv",
            f"votacoes-{ano}.csv",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ano", type=int, default=2026)
    parser.add_argument("--max-age-hours", type=int, default=24)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--delay", type=float, default=0.05)
    args = parser.parse_args()

    mapping = load_json(MAP_FILE)
    if not mapping:
        raise SystemExit(f"Mapa de identidades ausente: {MAP_FILE}")
    history = load_json(HISTORY_FILE, {"deputados": {}}) or {"deputados": {}}

    ids = confirmed_ids(mapping)
    if not ids:
        print("Atividade Camara: nenhum vinculo confirmado; nada a coletar.")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ids_to_refresh = [deputy_id for deputy_id in ids if not profile_fresh(OUT_DIR / f"{deputy_id}.json", args.max_age_hours)]

    print(f"Atividade Camara {args.ano}: {len(ids)} perfis confirmados; {len(ids_to_refresh)} para atualizar.")
    if not ids_to_refresh:
        return

    print("Baixando indice oficial de votos e votacoes...")
    votes_index = build_votes_index(set(ids_to_refresh), args.ano, args.max_age_hours)

    errors = []
    updated = 0
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as executor:
        futures = {
            executor.submit(
                collect_one,
                deputy_id,
                args.ano,
                votes_index.get(deputy_id, []),
                history,
                args.delay,
            ): deputy_id
            for deputy_id in ids_to_refresh
        }
        for index, future in enumerate(as_completed(futures), start=1):
            deputy_id = futures[future]
            try:
                _, payload = future.result()
                (OUT_DIR / f"{deputy_id}.json").write_text(
                    json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                updated += 1
                print(f"Atividade Camara {index}/{len(futures)}: {deputy_id} OK")
            except Exception as exc:
                errors.append({"camara_id_deputado": deputy_id, "erro": str(exc)})
                print(f"Atividade Camara {index}/{len(futures)}: {deputy_id} falhou: {str(exc)[:160]}")

    metadata = {
        "source": "Câmara dos Deputados - Dados Abertos",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "ano": args.ano,
        "perfis_confirmados": len(ids),
        "perfis_atualizados": updated,
        "falhas": errors,
        "cache_horas": args.max_age_hours,
        "escopo": ["despesas", "proposicoes", "votos nominais/posicionamentos registrados"],
    }
    META_FILE.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Atividade Camara concluida: {updated} perfis atualizados; {len(errors)} falhas.")


if __name__ == "__main__":
    main()
