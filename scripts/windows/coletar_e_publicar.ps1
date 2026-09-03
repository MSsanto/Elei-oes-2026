param(
    [switch]$Silent,
    [switch]$SkipPull,
    [switch]$NoPush
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = [Console]::OutputEncoding
}
catch {}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$LogDir = Join-Path $RepoRoot ".collector\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("coleta-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))

function Write-CollectorLog {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    if (-not $Silent) { Write-Host $line }
}

function Invoke-External {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments 2>&1 | Tee-Object -FilePath $LogFile -Append
    if ($LASTEXITCODE -ne 0) {
        throw "Comando falhou ($LASTEXITCODE): $Command $($Arguments -join ' ')"
    }
}

function Find-GitExecutable {
    $fromPath = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($fromPath) { return $fromPath.Source }

    $fixedCandidates = @(
        (Join-Path $env:ProgramFiles "Git\cmd\git.exe"),
        (Join-Path $env:ProgramFiles "Git\bin\git.exe")
    )
    if (${env:ProgramFiles(x86)}) {
        $fixedCandidates += (Join-Path ${env:ProgramFiles(x86)} "Git\cmd\git.exe")
    }
    foreach ($candidate in $fixedCandidates) {
        if ($candidate -and (Test-Path $candidate)) { return (Resolve-Path $candidate).Path }
    }

    $desktopRoot = Join-Path $env:LOCALAPPDATA "GitHubDesktop"
    if (Test-Path $desktopRoot) {
        $desktopApps = Get-ChildItem -Path $desktopRoot -Directory -Filter "app-*" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending
        foreach ($app in $desktopApps) {
            $desktopCandidates = @(
                (Join-Path $app.FullName "resources\app\git\cmd\git.exe"),
                (Join-Path $app.FullName "resources\app\git\bin\git.exe"),
                (Join-Path $app.FullName "resources\app\git\mingw64\bin\git.exe")
            )
            foreach ($candidate in $desktopCandidates) {
                if (Test-Path $candidate) { return (Resolve-Path $candidate).Path }
            }
        }
    }
    return $null
}

try {
    Set-Location $RepoRoot
    Write-CollectorLog "Iniciando coleta nacional Eleicoes 2026."
    Write-CollectorLog "Repositorio: $RepoRoot"

    if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
        throw "Esta pasta nao e um clone Git."
    }

    $GitCommand = Find-GitExecutable
    if (-not $GitCommand) {
        throw "Git nao encontrado. O coletor procurou no PATH, Git for Windows e no GitHub Desktop."
    }
    Write-CollectorLog "Git localizado: $GitCommand"
    Invoke-External $GitCommand @("--version")

    $statusLines = @(& $GitCommand status --porcelain)
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel consultar o estado do repositorio." }

    $nonGeneratedChanges = @()
    $generatedChanges = @()
    foreach ($line in $statusLines) {
        if (-not $line) { continue }
        $path = if ($line.Length -ge 4) { $line.Substring(3).Trim() } else { $line.Trim() }
        if ($path -like "data/processed*" -or $path -like "data\processed*") { $generatedChanges += $line }
        else { $nonGeneratedChanges += $line }
    }

    if ($nonGeneratedChanges.Count -gt 0) {
        Write-CollectorLog "Alteracoes locais encontradas fora da pasta de dados gerados:"
        foreach ($line in $nonGeneratedChanges) { Write-CollectorLog "  $line" }
        throw "Faca commit ou stash das alteracoes locais antes da coleta automatica."
    }

    if ($generatedChanges.Count -gt 0) {
        Write-CollectorLog "Limpando dados gerados por uma execucao anterior interrompida..."
        & $GitCommand restore --staged --worktree -- data/processed 2>$null
        & $GitCommand clean -fd -- data/processed 2>$null
    }

    if (-not $SkipPull) {
        Write-CollectorLog "Atualizando o codigo a partir da branch main..."
        Invoke-External $GitCommand @("pull", "--rebase", "origin", "main")
    }

    Write-CollectorLog "Executando coletor PowerShell do TSE (sem Python)..."
    $CollectorScript = Join-Path $PSScriptRoot "fetch_candidates_windows.ps1"
    if (-not (Test-Path $CollectorScript)) { throw "Coletor PowerShell nao encontrado: $CollectorScript" }
    Invoke-External "powershell.exe" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $CollectorScript)

    if (-not (Test-Path "data\processed\deputados_federais.json")) {
        throw "O coletor terminou sem gerar data/processed/deputados_federais.json."
    }
    if (-not (Test-Path "data\processed\metadata.json")) {
        throw "O coletor terminou sem gerar data/processed/metadata.json."
    }

    $metadata = Get-Content "data\processed\metadata.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-CollectorLog ("Carga validada: {0} candidatos; {1} UFs com registros." -f $metadata.records, $metadata.ufs_with_records)

    if ($NoPush) {
        Write-CollectorLog "Modo NoPush: arquivos gerados localmente; publicacao ignorada."
        exit 0
    }

    Write-CollectorLog "Preparando publicacao no GitHub..."
    Invoke-External $GitCommand @("add", "data/processed")
    $staged = (& $GitCommand diff --cached --name-only) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "Falha ao verificar alteracoes geradas." }

    if (-not $staged.Trim()) {
        Write-CollectorLog "O TSE nao trouxe alteracoes desde a ultima carga. Nada para publicar."
        exit 0
    }

    Invoke-External $GitCommand @("commit", "-m", "data: atualizar candidaturas nacionais do TSE")
    Invoke-External $GitCommand @("push", "origin", "main")

    Write-CollectorLog "Publicacao concluida. O Cloudflare Pages fara o deploy automaticamente."
    Write-CollectorLog "Site: https://eleicoes-2026-ebz.pages.dev"
    exit 0
}
catch {
    Write-CollectorLog ("ERRO: " + $_.Exception.Message)
    Write-CollectorLog "A carga anterior foi preservada. Consulte .collector/logs para diagnostico."
    exit 1
}
