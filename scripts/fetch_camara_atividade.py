#!/usr/bin/env python3
"""Coleta atividade factual da Câmara para vínculos TSE↔Câmara confirmados.

Escopo padrão: 2023–2026 (quatro anos da 57ª legislatura já transcorridos até 2026).
- despesas de exercício parlamentar: API /deputados/{id}/despesas;
- proposições com autoria publicada: API /proposicoes?idDeputadoAutor={id};
- votos/posicionamentos registrados: arquivos oficiais votacoesVotos-{ano}.csv;
- descrição das votações: arquivos oficiais votacoes-{ano}.csv.

O perfil mantém totais anuais e uma amostra recente por ano. Assim o frontend
pode mostrar quatro anos sem quadruplicar o peso dos JSONs. Anos encerrados
usam cache longo; o ano corrente continua sendo atualizado com frequência.

Não calcula ranking, nota ou avaliação política.
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
USER_AGENT = "Eleicoes-2026-Transparencia/0.5 (+https://github.com/MSsanto/Elei-oes-2026)"

DEFAULT_YEARS = [2023, 2024, 2025, 2026]
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


def parse_years(value: str | None, legacy_year: int | None) -> list[int]:
    if value:
        years = sorted({int(item.strip()) for item in value.split(",") if item.strip()})
    elif legacy_year:
        years = [legacy_year]
    else:
        years = list(DEFAULT_YEARS)
    if not years:
        raise SystemExit("Informe pelo menos um ano para coleta.")
    return years


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
    if not ids:
        return {}
    votes_file = cached_download(VOTES_URL.format(ano=ano), f"votacoesVotos-{ano}.csv", max_age_hours)
    votations_file = cached_download(VOTATIONS_URL.format(ano=ano), f"votacoes-{ano}.csv", max_age_hours)

    votations: dict[str, dict] = {}
    for row in read_csv(votations_file):
        vote_id = str(row_value(row, "id", "idVotacao") or "")
        if not vote_id:
            continue
        votations[vote_id] = {
            "data": row_value(row, "data"),
            "descricao": row_value(row, "descricao"),
            "aprovacao": row_value(row, "aprovacao"),
            "sigla_orgao": row_value(row, "siglaOrgao"),
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


def stamp_fresh(value: str | None, max_age_hours: int) -> bool:
    if not value:
        return False
    try:
        generated = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) - generated < timedelta(hours=max_age_hours)
    except Exception:
        return False


def year_needs_refresh(profile: dict, ano: int, current_year: int, current_max_age: int, historical_max_age: int) -> bool:
    block = (profile.get("anos") or {}).get(str(ano)) or {}
    limit = current_max_age if ano == current_year else historical_max_age
    return not stamp_fresh(block.get("generated_at_utc"), limit)


def collect_year(deputy_id: str, ano: int, votes: list[dict], delay: float) -> tuple[str, int, dict]:
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

    clean_expenses = [
        {
            "ano": item.get("ano") or ano,
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
        for item in expenses[:12]
    ]

    clean_propositions = [
        {
            "id": item.get("id"),
            "sigla_tipo": item.get("siglaTipo"),
            "numero": item.get("numero"),
            "ano": item.get("ano") or ano,
            "ementa": item.get("ementa"),
            "uri": item.get("uri"),
        }
        for item in propositions[:12]
    ]

    return deputy_id, ano, {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "despesas": {
            "quantidade_registros": len(expenses),
            "valor_liquido_total": round(total_liquido, 2),
            "registros_recentes": clean_expenses,
            "fonte_url": f"{BASE}/deputados/{deputy_id}/despesas?ano={ano}",
        },
        "proposicoes": {
            "quantidade_registros": len(propositions),
            "registros_recentes": clean_propositions,
            "fonte_url": f"{BASE}/proposicoes?idDeputadoAutor={deputy_id}",
        },
        "votacoes": {
            "quantidade_registros": len(votes),
            "registros_recentes": votes[:20],
            "fonte_url": VOTES_URL.format(ano=ano),
        },
    }


def sort_recent(records: list[dict], kind: str, limit: int) -> list[dict]:
    if kind == "despesas":
        key = lambda item: (str(item.get("data_documento") or ""), int(item.get("ano") or 0))
    elif kind == "votacoes":
        key = lambda item: (str(item.get("data_hora_voto") or item.get("data") or ""), str(item.get("id_votacao") or ""))
    else:
        key = lambda item: (int(item.get("ano") or 0), int(item.get("id") or 0))
    return sorted(records, key=key, reverse=True)[:limit]


def consolidate_profile(deputy_id: str, years: list[int], profile: dict, history_payload: dict) -> dict:
    annual = profile.get("anos") or {}
    period_start, period_end = min(years), max(years)

    expense_rows = []
    proposition_rows = []
    vote_rows = []
    expenses_by_year = []
    propositions_by_year = []
    votes_by_year = []

    for ano in years:
        block = annual.get(str(ano)) or {}
        expenses = block.get("despesas") or {}
        propositions = block.get("proposicoes") or {}
        votes = block.get("votacoes") or {}

        expenses_by_year.append({
            "ano": ano,
            "quantidade_registros": int(expenses.get("quantidade_registros") or 0),
            "valor_liquido_total": round(parse_number(expenses.get("valor_liquido_total")), 2),
        })
        propositions_by_year.append({
            "ano": ano,
            "quantidade_registros": int(propositions.get("quantidade_registros") or 0),
        })
        votes_by_year.append({
            "ano": ano,
            "quantidade_registros": int(votes.get("quantidade_registros") or 0),
        })
        expense_rows.extend(expenses.get("registros_recentes") or [])
        proposition_rows.extend(propositions.get("registros_recentes") or [])
        vote_rows.extend(votes.get("registros_recentes") or [])

    history = (history_payload.get("deputados") or {}).get(deputy_id) or {}
    detail = history.get("detalhe") or {}
    if isinstance(detail, list):
        detail = detail[0] if detail else {}

    profile.update({
        "schema_version": 2,
        "camara_id_deputado": deputy_id,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "periodo": {"inicio": period_start, "fim": period_end, "anos": years},
        "mandato": {
            "detalhe": detail,
            "historico": history.get("historico") or [],
            "fonte_url": f"{BASE}/deputados/{deputy_id}/historico",
        },
        "despesas": {
            "periodo": {"inicio": period_start, "fim": period_end},
            "quantidade_registros": sum(item["quantidade_registros"] for item in expenses_by_year),
            "valor_liquido_total": round(sum(item["valor_liquido_total"] for item in expenses_by_year), 2),
            "por_ano": expenses_by_year,
            "registros_recentes": sort_recent(expense_rows, "despesas", 24),
            "fonte_urls": [annual.get(str(ano), {}).get("despesas", {}).get("fonte_url") for ano in years],
        },
        "proposicoes": {
            "periodo": {"inicio": period_start, "fim": period_end},
            "quantidade_registros": sum(item["quantidade_registros"] for item in propositions_by_year),
            "por_ano": propositions_by_year,
            "registros_recentes": sort_recent(proposition_rows, "proposicoes", 24),
            "fonte_url": f"{BASE}/proposicoes?idDeputadoAutor={deputy_id}",
            "nota_metodologica": "A Câmara considera autores todos os signatários publicados da proposição.",
        },
        "votacoes": {
            "periodo": {"inicio": period_start, "fim": period_end},
            "quantidade_registros": sum(item["quantidade_registros"] for item in votes_by_year),
            "por_ano": votes_by_year,
            "registros_recentes": sort_recent(vote_rows, "votacoes", 40),
            "fonte_urls": [VOTES_URL.format(ano=ano) for ano in years],
            "nota_metodologica": "Os registros individuais são especialmente relevantes em votações nominais; a fonte também pode conter manifestações registradas em algumas votações simbólicas.",
        },
        "fontes": [
            "Câmara dos Deputados - Dados Abertos API v2",
            *[f"votacoesVotos-{ano}.csv" for ano in years],
            *[f"votacoes-{ano}.csv" for ano in years],
        ],
    })
    return profile


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--anos", help="Lista de anos separada por vírgula. Padrão: 2023,2024,2025,2026")
    parser.add_argument("--ano", type=int, help="Compatibilidade: coleta um único ano quando --anos não for informado")
    parser.add_argument("--max-age-hours", type=int, default=24, help="Cache do ano mais recente")
    parser.add_argument("--historical-max-age-hours", type=int, default=720, help="Cache dos anos encerrados")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--delay", type=float, default=0.05)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    years = parse_years(args.anos, args.ano)
    current_year = max(years)

    mapping = load_json(MAP_FILE)
    if not mapping:
        raise SystemExit(f"Mapa de identidades ausente: {MAP_FILE}")
    history = load_json(HISTORY_FILE, {"deputados": {}}) or {"deputados": {}}

    ids = confirmed_ids(mapping)
    if not ids:
        print("Atividade Câmara: nenhum vínculo confirmado; nada a coletar.")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    profiles: dict[str, dict] = {}
    refresh_by_year: dict[int, set[str]] = {ano: set() for ano in years}

    for deputy_id in ids:
        profile_path = OUT_DIR / f"{deputy_id}.json"
        existing = load_json(profile_path, {}) or {}
        if existing.get("schema_version") != 2:
            existing = {"anos": {}}
        existing.setdefault("anos", {})
        profiles[deputy_id] = existing
        for ano in years:
            if args.force or year_needs_refresh(
                existing,
                ano,
                current_year,
                args.max_age_hours,
                args.historical_max_age_hours,
            ):
                refresh_by_year[ano].add(deputy_id)

    total_tasks = sum(len(values) for values in refresh_by_year.values())
    print(
        f"Atividade Câmara {years[0]}–{years[-1]}: {len(ids)} perfis confirmados; "
        f"{total_tasks} bloco(s) anual(is) para atualizar."
    )

    if not total_tasks:
        metadata = {
            "source": "Câmara dos Deputados - Dados Abertos",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "anos": years,
            "perfis_confirmados": len(ids),
            "perfis_atualizados": 0,
            "blocos_anuais_atualizados": 0,
            "falhas": [],
            "cache_horas_ano_corrente": args.max_age_hours,
            "cache_horas_historico": args.historical_max_age_hours,
        }
        META_FILE.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    votes_indexes: dict[int, dict[str, list[dict]]] = {}
    for ano in years:
        ids_for_year = refresh_by_year[ano]
        if not ids_for_year:
            continue
        cache_hours = args.max_age_hours if ano == current_year else args.historical_max_age_hours
        print(f"Baixando índice oficial de votos e votações de {ano} para {len(ids_for_year)} perfis...")
        votes_indexes[ano] = build_votes_index(ids_for_year, ano, cache_hours)

    errors = []
    touched_profiles: set[str] = set()
    updated_blocks = 0

    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as executor:
        futures = {}
        for ano in years:
            for deputy_id in refresh_by_year[ano]:
                future = executor.submit(
                    collect_year,
                    deputy_id,
                    ano,
                    votes_indexes.get(ano, {}).get(deputy_id, []),
                    args.delay,
                )
                futures[future] = (deputy_id, ano)

        for index, future in enumerate(as_completed(futures), start=1):
            deputy_id, ano = futures[future]
            try:
                _, _, block = future.result()
                profiles[deputy_id].setdefault("anos", {})[str(ano)] = block
                touched_profiles.add(deputy_id)
                updated_blocks += 1
                print(f"Atividade Câmara {index}/{len(futures)}: {deputy_id} · {ano} OK")
            except Exception as exc:
                errors.append({"camara_id_deputado": deputy_id, "ano": ano, "erro": str(exc)})
                print(f"Atividade Câmara {index}/{len(futures)}: {deputy_id} · {ano} falhou: {str(exc)[:160]}")

    for deputy_id in touched_profiles:
        payload = consolidate_profile(deputy_id, years, profiles[deputy_id], history)
        (OUT_DIR / f"{deputy_id}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    complete_profiles = 0
    for deputy_id in ids:
        profile = profiles[deputy_id]
        if all((profile.get("anos") or {}).get(str(ano)) for ano in years):
            complete_profiles += 1

    metadata = {
        "source": "Câmara dos Deputados - Dados Abertos",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "anos": years,
        "periodo": {"inicio": years[0], "fim": years[-1]},
        "perfis_confirmados": len(ids),
        "perfis_atualizados": len(touched_profiles),
        "perfis_com_quatro_anos_processados": complete_profiles,
        "blocos_anuais_atualizados": updated_blocks,
        "falhas": errors,
        "cache_horas_ano_corrente": args.max_age_hours,
        "cache_horas_historico": args.historical_max_age_hours,
        "escopo": ["despesas", "proposições", "votos nominais/posicionamentos registrados"],
    }
    META_FILE.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Atividade Câmara concluída: {len(touched_profiles)} perfis atualizados, "
        f"{updated_blocks} blocos anuais, {len(errors)} falhas."
    )


if __name__ == "__main__":
    main()
