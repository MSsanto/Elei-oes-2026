Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Year = 2026
$Cargo = "DEPUTADO FEDERAL"
$CargoCode = 6
$ZipUrl = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip"
$RestBase = "https://divulgacandcontas.tse.jus.br/divulga/rest/v1"
$Ufs = @("AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO")

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ProcessedDir = Join-Path $RepoRoot "data\processed"
$UfDir = Join-Path $ProcessedDir "ufs"
$WorkDir = Join-Path $RepoRoot ".collector\tmp"

function Write-Utf8NoBom {
    param([string]$Path, [string]$Text)
    $parent = Split-Path -Parent $Path
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $encoding)
}

function Get-Value {
    param($Object, [string[]]$Names)
    foreach ($name in $Names) {
        if ($null -eq $Object) { continue }
        $property = $Object.PSObject.Properties[$name]
        if ($property -and $null -ne $property.Value -and [string]$property.Value -ne "") {
            return $property.Value
        }
    }
    return ""
}

function Normalize-Text {
    param($Value)
    if ($null -eq $Value) { return "" }
    return ([string]$Value).Trim()
}

function New-CandidateFromCsv {
    param($Row)
    $uf = Normalize-Text (Get-Value $Row @("SG_UF"))
    return [pscustomobject][ordered]@{
        ano_eleicao = "$Year"
        uf = $uf
        id_tse = Normalize-Text (Get-Value $Row @("SQ_CANDIDATO"))
        numero = Normalize-Text (Get-Value $Row @("NR_CANDIDATO"))
        nome = Normalize-Text (Get-Value $Row @("NM_CANDIDATO"))
        nome_urna = Normalize-Text (Get-Value $Row @("NM_URNA_CANDIDATO", "NM_URNA"))
        partido = Normalize-Text (Get-Value $Row @("SG_PARTIDO"))
        numero_partido = Normalize-Text (Get-Value $Row @("NR_PARTIDO"))
        situacao_candidatura = Normalize-Text (Get-Value $Row @("DS_SITUACAO_CANDIDATURA", "DS_SITUACAO_CANDIDATO", "DS_DETALHE_SITUACAO_CAND"))
        situacao_urna = Normalize-Text (Get-Value $Row @("DS_SITUACAO_CANDIDATO_TOT"))
        genero = Normalize-Text (Get-Value $Row @("DS_GENERO"))
        grau_instrucao = Normalize-Text (Get-Value $Row @("DS_GRAU_INSTRUCAO"))
        ocupacao = Normalize-Text (Get-Value $Row @("DS_OCUPACAO"))
        cor_raca = Normalize-Text (Get-Value $Row @("DS_COR_RACA"))
        data_nascimento = Normalize-Text (Get-Value $Row @("DT_NASCIMENTO"))
        email = Normalize-Text (Get-Value $Row @("NM_EMAIL"))
        foto_url = ""
        ultima_atualizacao_tse = Normalize-Text (Get-Value $Row @("DT_GERACAO"))
    }
}

function New-CandidateFromRest {
    param($Row, [string]$Uf, [string]$ElectionId)
    $party = Get-Value $Row @("partido")
    $partySigla = ""
    $partyNumber = ""
    if ($party -and $party -isnot [string]) {
        $partySigla = Normalize-Text (Get-Value $party @("sigla"))
        $partyNumber = Normalize-Text (Get-Value $party @("numero"))
    }
    $id = Normalize-Text (Get-Value $Row @("id", "sq_CANDIDATO", "sqCandidato"))
    $photo = Normalize-Text (Get-Value $Row @("fotoUrl", "urlFoto"))
    if (-not $photo -and $id) {
        $photo = "https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/$ElectionId/$id/$Uf"
    }
    return [pscustomobject][ordered]@{
        ano_eleicao = "$Year"
        uf = Normalize-Text (Get-Value $Row @("ufCandidatura"))
        id_tse = $id
        numero = Normalize-Text (Get-Value $Row @("numero", "nr_CANDIDATO", "nrCandidato"))
        nome = Normalize-Text (Get-Value $Row @("nomeCompleto", "nm_CANDIDATO", "nome"))
        nome_urna = Normalize-Text (Get-Value $Row @("nomeUrna", "nm_URNA", "nmUrna"))
        partido = $(if ($partySigla) { $partySigla } else { Normalize-Text (Get-Value $Row @("sg_PARTIDO", "siglaPartido")) })
        numero_partido = $(if ($partyNumber) { $partyNumber } else { Normalize-Text (Get-Value $Row @("nr_PARTIDO", "numeroPartido")) })
        situacao_candidatura = Normalize-Text (Get-Value $Row @("descricaoSituacao", "situacaoCandidato", "descricaoSituacaoCandidato"))
        situacao_urna = Normalize-Text (Get-Value $Row @("descricaoTotalizacao", "situacaoTotalizacao"))
        genero = Normalize-Text (Get-Value $Row @("descricaoSexo", "genero"))
        grau_instrucao = Normalize-Text (Get-Value $Row @("grauInstrucao", "descricaoGrauInstrucao"))
        ocupacao = Normalize-Text (Get-Value $Row @("ocupacao", "descricaoOcupacao"))
        cor_raca = Normalize-Text (Get-Value $Row @("descricaoCorRaca", "corRaca"))
        data_nascimento = Normalize-Text (Get-Value $Row @("dataDeNascimento", "dataNascimento"))
        email = ""
        foto_url = $photo
        ultima_atualizacao_tse = Normalize-Text (Get-Value $Row @("dataUltimaAtualizacao"))
    }
}

function Save-Candidates {
    param([object[]]$Candidates, [string]$Mode, [string]$SourceUrl)

    $byId = @{}
    foreach ($candidate in $Candidates) {
        if (-not $candidate.id_tse) { continue }
        if (-not $candidate.uf) { continue }
        if (-not $candidate.nome_urna) { $candidate.nome_urna = $candidate.nome }
        $byId[[string]$candidate.id_tse] = $candidate
    }
    $clean = @($byId.Values | Sort-Object uf, nome_urna, id_tse)
    if ($clean.Count -lt 100) {
        throw "Carga recusada por seguranca: somente $($clean.Count) candidaturas foram encontradas."
    }

    New-Item -ItemType Directory -Force -Path $ProcessedDir | Out-Null
    New-Item -ItemType Directory -Force -Path $UfDir | Out-Null

    Write-Utf8NoBom (Join-Path $ProcessedDir "deputados_federais.json") (($clean | ConvertTo-Json -Depth 6))

    $ufsWithRecords = @($clean | Select-Object -ExpandProperty uf -Unique | Sort-Object)
    foreach ($uf in $Ufs) {
        $items = @($clean | Where-Object { $_.uf -eq $uf })
        Write-Utf8NoBom (Join-Path $UfDir "$uf.json") (($items | ConvertTo-Json -Depth 6))
    }

    $metadata = [pscustomobject][ordered]@{
        source = "Tribunal Superior Eleitoral"
        source_url = $SourceUrl
        source_mode = $Mode
        generated_at_utc = [DateTime]::UtcNow.ToString("o")
        cargo = $Cargo
        cargo_code = $CargoCode
        records = $clean.Count
        ufs = $Ufs
        ufs_with_records = $ufsWithRecords.Count
    }
    Write-Utf8NoBom (Join-Path $ProcessedDir "metadata.json") ($metadata | ConvertTo-Json -Depth 5)
    Write-Host "COLETA CONCLUIDA: $($clean.Count) candidaturas em $($ufsWithRecords.Count) UFs."
}

function Collect-FromZip {
    Write-Host "Tentando ZIP oficial do Portal de Dados Abertos do TSE..."
    if (Test-Path $WorkDir) { Remove-Item $WorkDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
    $zipPath = Join-Path $WorkDir "consulta_cand_2026.zip"
    $extractDir = Join-Path $WorkDir "consulta_cand_2026"

    $headers = @{ "User-Agent" = "Mozilla/5.0 Eleicoes-2026-Transparencia/1.0" }
    Invoke-WebRequest -Uri $ZipUrl -OutFile $zipPath -Headers $headers -UseBasicParsing -TimeoutSec 180
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

    $csvFiles = @(Get-ChildItem -Path $extractDir -Filter "*.csv" -File -Recurse)
    if ($csvFiles.Count -eq 0) { throw "O ZIP do TSE nao continha arquivos CSV." }

    $all = New-Object System.Collections.Generic.List[object]
    foreach ($csv in $csvFiles) {
        Write-Host "Lendo $($csv.Name)..."
        $rows = @(Import-Csv -Path $csv.FullName -Delimiter ';' -Encoding Default)
        foreach ($row in $rows) {
            $cargoValue = Normalize-Text (Get-Value $row @("DS_CARGO"))
            if ($cargoValue.ToUpperInvariant() -ne $Cargo) { continue }
            $candidate = New-CandidateFromCsv $row
            if ($candidate.id_tse) { $all.Add($candidate) }
        }
    }
    if ($all.Count -eq 0) { throw "Nenhum Deputado Federal foi encontrado no ZIP do TSE." }
    Save-Candidates -Candidates $all.ToArray() -Mode "portal-dados-abertos-zip" -SourceUrl $ZipUrl
}

function Find-ElectionIdRecursive {
    param($Value)
    if ($null -eq $Value) { return $null }
    if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [string] -and $Value -isnot [pscustomobject]) {
        foreach ($item in $Value) {
            $found = Find-ElectionIdRecursive $item
            if ($found) { return $found }
        }
        return $null
    }
    if ($Value -is [pscustomobject] -or $Value -is [hashtable]) {
        $year = Get-Value $Value @("ano", "anoEleicao", "nrAno")
        $id = Get-Value $Value @("id", "idEleicao", "sqEleicao")
        if ([string]$year -eq "$Year" -and $id) { return [string]$id }
        foreach ($prop in $Value.PSObject.Properties) {
            if ($prop.Value -and $prop.Value -isnot [string]) {
                $found = Find-ElectionIdRecursive $prop.Value
                if ($found) { return $found }
            }
        }
    }
    return $null
}

function Collect-FromRest {
    Write-Host "Tentando REST oficial do DivulgaCandContas..."
    $headers = @{
        "User-Agent" = "Mozilla/5.0 Eleicoes-2026-Transparencia/1.0"
        "Accept" = "application/json, text/plain, */*"
        "Referer" = "https://divulgacandcontas.tse.jus.br/"
    }
    $elections = Invoke-RestMethod -Uri "$RestBase/eleicao/ordinarias" -Headers $headers -TimeoutSec 120
    $electionId = Find-ElectionIdRecursive $elections
    if (-not $electionId) { throw "Nao foi possivel localizar o ID da eleicao 2026 no DivulgaCandContas." }
    Write-Host "ID da eleicao 2026: $electionId"

    $all = New-Object System.Collections.Generic.List[object]
    foreach ($uf in $Ufs) {
        $url = "$RestBase/candidatura/listar/$Year/$uf/$electionId/$CargoCode/candidatos"
        try {
            $payload = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 120
            $raw = @()
            if ($payload -is [System.Array]) { $raw = @($payload) }
            elseif ($payload.PSObject.Properties["candidatos"]) { $raw = @($payload.candidatos) }
            foreach ($row in $raw) {
                $candidate = New-CandidateFromRest $row $uf $electionId
                if (-not $candidate.uf) { $candidate.uf = $uf }
                if ($candidate.id_tse) { $all.Add($candidate) }
            }
            Write-Host "$uf: $($raw.Count) candidaturas"
        }
        catch {
            throw "Falha ao consultar $uf no DivulgaCandContas: $($_.Exception.Message)"
        }
        Start-Sleep -Milliseconds 150
    }
    Save-Candidates -Candidates $all.ToArray() -Mode "divulgacandcontas-rest" -SourceUrl $RestBase
}

$zipError = $null
try {
    Collect-FromZip
    return
}
catch {
    $zipError = $_.Exception.Message
    Write-Warning "ZIP oficial falhou: $zipError"
}

try {
    Collect-FromRest
    return
}
catch {
    throw "As duas fontes oficiais falharam. ZIP: $zipError | REST: $($_.Exception.Message)"
}
