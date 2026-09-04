from pathlib import Path

# Migração temporária e idempotente; remover após aplicar no frontend.
path = Path('src/multiCargoMain.jsx')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "import { ChamberActivity, chamberBasePhoto, displayTseValue } from './chamberProfile.jsx';",
        "import { ChamberActivity, chamberBasePhoto, displayTseValue } from './chamberProfile.jsx';\nimport StateDeputiesView from './stateDeputies.jsx';",
    ),
    (
        "  'deputado-federal': {\n    slug: 'deputado-federal',",
        "  'deputado-estadual': {\n    slug: 'deputado-estadual',\n    label: 'Deputado Estadual',\n    plural: 'Deputado Estadual/Distrital',\n    kicker: 'ASSEMBLEIAS LEGISLATIVAS E CÂMARA LEGISLATIVA DO DF',\n    scopeLabel: 'UF selecionada',\n    requiresUf: true,\n    supportsUf: true,\n    hasChamber: false,\n    paged: true,\n  },\n  'deputado-federal': {\n    slug: 'deputado-federal',",
    ),
    (
        "  const tabs = ['presidente', 'governador', 'senador', 'deputado-federal'];",
        "  const tabs = ['presidente', 'governador', 'senador', 'deputado-federal', 'deputado-estadual'];",
    ),
    (
        "    if (config.requiresUf && !uf) {\n      setStatus('needs-uf');",
        "    if (config.paged) {\n      setStatus('custom');\n      setStatusMessage('Consulta estadual em modo leve.');\n      return () => { active = false; };\n    }\n\n    if (config.requiresUf && !uf) {\n      setStatus('needs-uf');",
    ),
    (
        "  useEffect(() => {\n    if (status !== 'ready' || candidates.length === 0) return;\n    const candidateId = initialParam('candidato');",
        "  useEffect(() => {\n    if (config.paged || status !== 'ready' || candidates.length === 0) return;\n    const candidateId = initialParam('candidato');",
    ),
    (
        "  }, [candidates, status]);",
        "  }, [candidates, status, config.paged]);",
    ),
    (
        "      <main>\n        <section className=\"stats-wrap\" aria-label=\"Resumo dos dados\">",
        "      <main>\n        {config.paged ? (\n          <StateDeputiesView\n            uf={uf}\n            setUf={setUf}\n            query={query}\n            setQuery={setQuery}\n            party={party}\n            setParty={setParty}\n            occupation={occupation}\n            setOccupation={setOccupation}\n            sortBy={sortBy}\n            setSortBy={setSortBy}\n            onOpen={openCandidate}\n            onShare={shareCandidate}\n          />\n        ) : (\n          <>\n        <section className=\"stats-wrap\" aria-label=\"Resumo dos dados\">",
    ),
    (
        "        <section className=\"method-section\">",
        "          </>\n        )}\n\n        <section className=\"method-section\">",
    ),
]

for old, new in replacements:
    if old not in text:
        if new in text:
            continue
        raise SystemExit(f'Padrão não encontrado: {old[:120]!r}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('OK: Deputado Estadual/Distrital integrado ao frontend multi-cargo')
