#!/usr/bin/env python3
"""Adaptador do coletor de atividade da Câmara para execução em nuvem.

A API /proposicoes aceita filtro por ano diretamente. O coletor principal usa
intervalos de datas para manter compatibilidade local; este adaptador converte
cada intervalo para o parâmetro `ano` antes de chamar a API.

A validação final rejeita apenas uma coleta que precisava atualizar blocos e
não conseguiu atualizar nenhum. Execuções totalmente em cache continuam
válidas.
"""

from __future__ import annotations

import json
from pathlib import Path

import fetch_camara_atividade as collector


_original_api_all = collector.api_all


def api_all_cloud(path: str, params: dict | None = None) -> list[dict]:
    query = dict(params or {})

    if path == "/proposicoes":
        start = str(query.pop("dataApresentacaoInicio", "") or "")
        end = str(query.pop("dataApresentacaoFim", "") or "")
        year_text = (start or end)[:4]
        if year_text.isdigit():
            query["ano"] = int(year_text)

        if "ordem" in query:
            query["ordem"] = str(query["ordem"]).lower()

    return _original_api_all(path, query)


def main() -> None:
    collector.api_all = api_all_cloud
    collector.main()

    metadata_path = collector.META_FILE
    if not Path(metadata_path).exists():
        return

    metadata = json.loads(Path(metadata_path).read_text(encoding="utf-8"))
    confirmed = int(metadata.get("perfis_confirmados") or 0)
    updated_profiles = int(metadata.get("perfis_atualizados") or 0)
    updated_blocks = int(metadata.get("blocos_anuais_atualizados") or 0)
    failures = metadata.get("falhas") or []

    # Se houve falhas e nenhum bloco foi produzido, a execução não pode ficar verde.
    if confirmed > 0 and failures and updated_profiles == 0 and updated_blocks == 0:
        first_error = failures[0].get("erro") if isinstance(failures[0], dict) else None
        detail = f" Primeiro erro: {first_error}" if first_error else ""
        raise SystemExit(
            "Coleta de atividade da Câmara recusada: nenhum bloco anual foi atualizado."
            + detail
        )


if __name__ == "__main__":
    main()
