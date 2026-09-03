from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = ROOT / 'data' / 'processed'
OUTPUT_PATH = PROCESSED_DIR / 'deputados_federais.json'
META_PATH = PROCESSED_DIR / 'metadata.json'
PROXY_URL = 'https://eleicoes-2026-ebz.pages.dev/api/candidates?uf=SP&limit=1000'


def main() -> None:
    print(f'Consultando proxy Cloudflare: {PROXY_URL}')
    request = urllib.request.Request(
        PROXY_URL,
        headers={'User-Agent': 'Eleicoes-2026-GitHub-Collector/0.2', 'Accept': 'application/json'},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.load(response)

    candidates = payload.get('candidates', [])
    if not isinstance(candidates, list) or not candidates:
        raise RuntimeError(f'Proxy respondeu sem candidatos: {payload}')

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(candidates, ensure_ascii=False, indent=2), encoding='utf-8')

    metadata = {
        'source': payload.get('source', 'TSE DivulgaCandContas via Cloudflare'),
        'proxy': PROXY_URL,
        'generated_at_utc': payload.get('generated_at_utc') or datetime.now(timezone.utc).isoformat(),
        'cargo': 'DEPUTADO FEDERAL',
        'uf': payload.get('uf', 'SP'),
        'election_id': payload.get('election_id'),
        'records': len(candidates),
        'mode': 'cloudflare-proxy',
    }
    META_PATH.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Concluído: {len(candidates)} candidatos de SP gravados.')


if __name__ == '__main__':
    main()
