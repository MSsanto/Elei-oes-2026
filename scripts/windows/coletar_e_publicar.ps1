param(
    [switch]$Silent,
    [switch]$SkipPull,
    [switch]$NoPush
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$LogDir = Join-Path $RepoRoot ".collector\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("coleta-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))

function Write-CollectorLog {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    if (-not $Silent) {
        Write-Host $line
    }
}

function Invoke-External {
    param(
        [string]$Command,
        [string[]]$Arguments
    )
    & $Command @Arguments 2>&1 | Tee-Object -FilePath $LogFile -Append
    if ($LASTEXITCODE -ne 0) {
        throw "Comando falhou ($LASTEXITCODE): $Command $($Arguments -join ' ')"
    }
}

try {
    Set-Location $RepoRoot
    Write-CollectorLog "Iniciando coleta nacional Eleições 2026."
    Write-CollectorLog "Repositório: $RepoRoot"

    if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
        throw "Esta pasta não é um clone Git. Clone MSsanto/Elei-oes-2026 antes de executar o coletor."
    }

    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) {
        throw "Git não encontrado. Instale o Git for Windows e abra novamente este arquivo."
    }

    $py = Get-Command py -ErrorAction SilentlyContinue
    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($py) {
        $PythonCommand = "py"
        $PythonPrefix = @("-3")
    }
    elseif ($python) {
        $PythonCommand = "python"
        $PythonPrefix = @()
    }
    else {
        throw "Python 3 não encontrado. Instale o Python 3 e marque a opção 'Add Python to PATH'."
    }

    $statusLines = @(& git status --porcelain)
    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível consultar o estado do repositório."
    }

    $nonGeneratedChanges = @()
    $generatedChanges = @()
    foreach ($line in $statusLines) {
        if (-not $line) { continue }
        $path = if ($line.Length -ge 4) { $line.Substring(3).Trim() } else { $line.Trim() }
        if ($path -like "data/processed*" -or $path -like "data\processed*") {
            $generatedChanges += $line
        }
        else {
            $nonGeneratedChanges += $line
        }
    }

    if ($nonGeneratedChanges.Count -gt 0) {
        Write-CollectorLog "Alterações locais encontradas fora da pasta de dados gerados:"
        foreach ($line in $nonGeneratedChanges) { Write-CollectorLog "  $line" }
        throw "Faça commit ou stash das alterações locais antes da coleta automática."
    }

    if ($generatedChanges.Count -gt 0) {
        Write-CollectorLog "Limpando arquivos gerados deixados por uma execução anterior interrompida..."
        & git restore --staged --worktree -- data/processed 2>$null
        & git clean -fd -- data/processed 2>$null
    }

    if (-not $SkipPull) {
        Write-CollectorLog "Atualizando o código a partir da branch main..."
        Invoke-External "git" @("pull", "--rebase", "origin", "main")
    }

    Write-CollectorLog "Executando coletor nacional do TSE..."
    $pythonArgs = @($PythonPrefix + @("scripts\fetch_candidates.py"))
    Invoke-External $PythonCommand $pythonArgs

    if (-not (Test-Path "data\processed\deputados_federais.json")) {
        throw "O coletor terminou sem gerar data/processed/deputados_federais.json."
    }
    if (-not (Test-Path "data\processed\metadata.json")) {
        throw "O coletor terminou sem gerar data/processed/metadata.json."
    }

    $metadata = Get-Content "data\processed\metadata.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-CollectorLog ("Carga validada: {0} candidatos; {1} UFs com registros." -f $metadata.records, $metadata.ufs_with_records)

    if ($NoPush) {
        Write-CollectorLog "Modo NoPush: arquivos gerados localmente; publicação no GitHub ignorada."
        exit 0
    }

    Write-CollectorLog "Preparando publicação no GitHub..."
    Invoke-External "git" @("add", "data/processed")
    $staged = (& git diff --cached --name-only) -join "`n"
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao verificar alterações geradas."
    }

    if (-not $staged.Trim()) {
        Write-CollectorLog "O TSE não trouxe alterações desde a última carga. Nada para publicar."
        exit 0
    }

    Invoke-External "git" @("commit", "-m", "data: atualizar candidaturas nacionais do TSE")
    Invoke-External "git" @("push", "origin", "main")

    Write-CollectorLog "Publicação concluída. O Cloudflare Pages fará o novo deploy automaticamente."
    Write-CollectorLog "Site: https://eleicoes-2026-ebz.pages.dev"
    exit 0
}
catch {
    Write-CollectorLog ("ERRO: " + $_.Exception.Message)
    Write-CollectorLog "A carga anterior foi preservada. Consulte o arquivo de log para diagnóstico."
    exit 1
}
