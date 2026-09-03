from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

WORKER_ROOT = "https://eleicoes-2026-tse-browser-probe.matheus-sergio.workers.dev"
EXPECTED_REVISION = "tse-divulgacand-inspect-v4"


def main() -> int:
    token = os.environ.get("TSE_WORKER_TOKEN", "").strip()
    if not token:
        raise RuntimeError("TSE_WORKER_TOKEN ausente")

    request = urllib.request.Request(
        f"{WORKER_ROOT}/inspect-divulgacand-fields",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": "Eleicoes-2026-Diagnostico-DivulgaCand/1.0",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read(800).decode("utf-8", errors="replace")
        raise RuntimeError(f"Worker retornou HTTP {error.code}: {body}") from error

    revision = payload.get("worker_revision")
    if revision != EXPECTED_REVISION:
        raise RuntimeError(
            f"Worker ativo em revisao inesperada: {revision!r}; esperado={EXPECTED_REVISION!r}"
        )

    print(f"Worker revision: {revision}")
    print(f"Diagnostico OK: {payload.get('ok')}")

    reference = payload.get("test_reference") or {}
    print(
        "Referencia tecnica: "
        f"ano={reference.get('ano')} uf={reference.get('uf')} "
        f"sq_candidato={reference.get('sq_candidato')} "
        f"election_id={reference.get('election_id')}"
    )

    http = payload.get("http") or {}
    print("Status HTTP:")
    print(f"- portal: {http.get('portal_status')}")
    print(f"- eleicoes: {http.get('elections_status')}")
    print(f"- detalhe candidato: {http.get('candidate_detail_status')}")

    inventory = payload.get("field_inventory") or {}
    print(f"Total de caminhos de campos: {inventory.get('total_unique_paths')}")

    print("\nCampos de primeiro nivel:")
    for key in inventory.get("top_level_keys") or []:
        print(f"- {key}")

    print("\nCampos potencialmente relacionados a domicilio/municipio/eleitorado:")
    relevant = inventory.get("relevant_paths") or []
    if relevant:
        for path in relevant:
            print(f"- {path}")
    else:
        print("- nenhum")

    privacy = payload.get("privacy") or {}
    if privacy.get("values_returned") is not False:
        raise RuntimeError("Protecao de privacidade do diagnostico nao foi confirmada")
    print("\nPrivacidade: somente nomes de campos; valores individuais nao foram exibidos.")

    if not payload.get("ok"):
        raise RuntimeError(payload.get("error") or "Diagnostico do DivulgaCand nao concluiu com sucesso")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERRO: {error}", file=sys.stderr)
        raise SystemExit(1)
