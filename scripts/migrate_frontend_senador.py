from pathlib import Path

path = Path('src/multiCargoMain.jsx')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "    metaUrl: '/data/candidatos/governador/manifest.json',\n  },\n  'deputado-federal': {",
        "    metaUrl: '/data/candidatos/governador/manifest.json',\n  },\n  senador: {\n    slug: 'senador',\n    label: 'Senador',\n    plural: 'Senador',\n    kicker: 'SENADO FEDERAL',\n    scopeLabel: 'UF selecionada',\n    requiresUf: true,\n    supportsUf: true,\n    hasChamber: false,\n    dataUrl: (uf) => `/data/candidatos/senador/${uf}.json`,\n    metaUrl: '/data/candidatos/senador/manifest.json',\n  },\n  'deputado-federal': {",
    ),
    (
        "  const tabs = ['presidente', 'governador', 'deputado-federal'];",
        "  const tabs = ['presidente', 'governador', 'senador', 'deputado-federal'];",
    ),
    (
        "      setStatusMessage('Escolha uma UF para carregar as candidaturas a Governador.');",
        "      setStatusMessage(`Escolha uma UF para carregar as candidaturas a ${config.label}.`);",
    ),
    (
        "  const scopeValue = cargo === 'presidente'\n    ? 'Brasil'\n    : cargo === 'governador'\n      ? (uf || 'Escolha uma UF')\n      : `${stats.ufs} UFs`;",
        "  const scopeValue = cargo === 'presidente'\n    ? 'Brasil'\n    : config.requiresUf\n      ? (uf || 'Escolha uma UF')\n      : `${stats.ufs} UFs`;",
    ),
    (
        "              <strong>Escolha uma UF para consultar Governador</strong>",
        "              <strong>Escolha uma UF para consultar {config.label}</strong>",
    ),
]

for old, new in replacements:
    if old not in text:
        if new in text:
            continue
        raise SystemExit(f'Padrão não encontrado para migração: {old[:80]!r}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('OK: frontend multi-cargo atualizado com Senador')
