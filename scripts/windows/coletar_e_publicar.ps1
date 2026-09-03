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

    $previousPreference = $ErrorActionPreference
    $exitCode = 0
    $output = @()
    try {
        $ErrorActionPreference = "Continue"
        $output = @(& $Command @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }

    foreach ($item in $output) {
        $text = [string]$item
        if (-not $text) { continue }
        Add-Content -Path $LogFile -Value $text -Encoding UTF8
        if (-not $Silent) { Write-Host $text }
    }

    if ($exitCode -ne 0) {
        throw "Comando falhou ($exitCode): $Command $($Arguments -join ' ')"
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

function Test-NativeCommand {
    param([string]$Command, [string[]]$Arguments)
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $Command @Arguments *> $null
        return ($LASTEXITCODE -eq 0)
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Find-PythonExecutable {
    $launcher = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($launcher -and (Test-NativeCommand $launcher.Source @("-3", "--version"))) {
        return @{ Command = $launcher.Source; Prefix = @("-3") }
    }

    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python -and (Test-NativeCommand $python.Source @("--version"))) {
        return @{ Command = $python.Source; Prefix = @() }
    }

    $roots = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Python"),
        $env:ProgramFiles
    )
    if (${env:ProgramFiles(x86)}) { $roots += ${env:ProgramFiles(x86)} }

    foreach ($root in $roots) {
        if (-not $root -or -not (Test-Path $root)) { continue }
        $found = Get-ChildItem -Path $root -Filter "python.exe" -File -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match "Python" } |
            Sort-Object FullName -Descending |
            Select-Object -First 1
        if ($found -and (Test-NativeCommand $found.FullName @("--version"))) {
            return @{ Command = $found.FullName; Prefix = @() }
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

    $DirectCollectorScript = Join-Path $PSScriptRoot "fetch_candidates_windows.ps1"
    $directSuccess = $false
    if (Test-Path $DirectCollectorScript) {
        Write-CollectorLog "Tentando coleta HTTP direta do TSE..."
        try {
            Invoke-External "powershell.exe" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $DirectCollectorScript)
            $directSuccess = $true
        }
        catch {
            Write-CollectorLog "A coleta HTTP direta foi bloqueada. Ativando fallback via Chrome/Python."
        }
    }

    $PythonInfo = Find-PythonExecutable
    if (-not $PythonInfo) {
        throw "Python 3 nao foi localizado. Ele e necessario para o fallback do TSE e para o cruzamento com a Camara."
    }
    $PythonCommand = [string]$PythonInfo.Command
    $PythonPrefix = [string[]]$PythonInfo.Prefix
    Write-CollectorLog "Python localizado: $PythonCommand"
    Invoke-External $PythonCommand @($PythonPrefix + @("--version"))

    if (-not $directSuccess) {
        $seleniumInstalled = Test-NativeCommand $PythonCommand @($PythonPrefix + @("-c", "import selenium"))
        if (-not $seleniumInstalled) {
            Write-CollectorLog "Selenium nao encontrado. Instalando dependencia do coletor no seu perfil de usuario..."
            Invoke-External $PythonCommand @($PythonPrefix + @("-m", "pip", "install", "--user", "-r", "requirements-collector.txt"))
        }

        Write-CollectorLog "Abrindo Chrome automatizado para atravessar o bloqueio do TSE..."
        Write-CollectorLog "Uma janela do Chrome pode aparecer. Nao a feche durante a coleta."
        $BrowserCollector = Join-Path $RepoRoot "scripts\fetch_candidates_browser.py"
        Invoke-External $PythonCommand @($PythonPrefix + @($BrowserCollector))
    }

    if (-not (Test-Path "data\processed\deputados_federais.json")) {
        throw "O coletor terminou sem gerar data/processed/deputados_federais.json."
    }
    if (-not (Test-Path "data\processed\metadata.json")) {
        throw "O coletor terminou sem gerar data/processed/metadata.json."
    }

    $metadata = Get-Content "data\processed\metadata.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-CollectorLog ("Carga TSE validada: {0} candidatos; {1} UFs com registros." -f $metadata.records, $metadata.ufs_with_records)

    Write-CollectorLog "Enriquecendo naturalidade com Codigo Nacional (DDD) oficial da Anatel..."
    Invoke-External $PythonCommand @($PythonPrefix + @("scripts\enrich_candidate_region.py"))

    Write-CollectorLog "Atualizando catalogo historico oficial da Camara dos Deputados..."
    Invoke-External $PythonCommand @($PythonPrefix + @("scripts\fetch_camara.py"))

    Write-CollectorLog "Cruzando candidatos 2026 com o historico da Camara..."
    Invoke-External $PythonCommand @($PythonPrefix + @("scripts\build_identity_map.py"))

    Write-CollectorLog "Atualizando historico de exercicio dos vinculos confirmados (cache 12h)..."
    Invoke-External $PythonCommand @($PythonPrefix + @("scripts\fetch_camara_historico.py", "--max-age-hours", "12"))

    Write-CollectorLog "Atualizando despesas, proposicoes e votacoes da Camara de 2026 (cache 24h)..."
    Invoke-External $PythonCommand @($PythonPrefix + @("scripts\fetch_camara_atividade.py", "--ano", "2026", "--max-age-hours", "24"))

    if (-not (Test-Path "data\processed\mappings\identidades.json")) {
        throw "O cruzamento TSE-Camara terminou sem gerar identidades.json."
    }

    if ($NoPush) {
        Write-CollectorLog "Modo NoPush: arquivos gerados localmente; publicacao ignorada."
        exit 0
    }

    Write-CollectorLog "Preparando publicacao das bases oficiais no GitHub..."
    Invoke-External $GitCommand @("add", "data/processed")
    $staged = (& $GitCommand diff --cached --name-only) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "Falha ao verificar alteracoes geradas." }

    if (-not $staged.Trim()) {
        Write-CollectorLog "Nenhuma fonte oficial trouxe alteracoes desde a ultima carga. Nada para publicar."
        exit 0
    }

    Invoke-External $GitCommand @("commit", "-m", "data: atualizar TSE e historico da Camara")
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
