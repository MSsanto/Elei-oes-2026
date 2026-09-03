Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Collector = Join-Path $PSScriptRoot "coletar_e_publicar.ps1"
$TaskName = "Eleicoes2026-Coletor-TSE"

if (-not (Test-Path $Collector)) {
    throw "Coletor não encontrado: $Collector"
}

$PowerShellExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Collector`" -Silent"

$Action = New-ScheduledTaskAction `
    -Execute $PowerShellExe `
    -Argument $Arguments `
    -WorkingDirectory $RepoRoot

$Times = @("00:25", "06:25", "12:25", "18:25")
$Triggers = foreach ($Time in $Times) {
    $At = [DateTime]::ParseExact($Time, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
    New-ScheduledTaskTrigger -Daily -At $At
}

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 45)

$UserId = "$env:USERDOMAIN\$env:USERNAME"
$Principal = New-ScheduledTaskPrincipal `
    -UserId $UserId `
    -LogonType Interactive `
    -RunLevel Limited

$Task = New-ScheduledTask `
    -Action $Action `
    -Trigger $Triggers `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Atualiza dados públicos das Eleições 2026 a partir do TSE e publica no GitHub/Cloudflare."

Register-ScheduledTask -TaskName $TaskName -InputObject $Task -Force | Out-Null

Write-Host ""
Write-Host "Agendamento instalado com sucesso." -ForegroundColor Green
Write-Host "Tarefa: $TaskName"
Write-Host "Horários: 00:25, 06:25, 12:25 e 18:25 (horário local do Windows)."
Write-Host "Se o computador estiver desligado, o Windows tentará executar a tarefa quando ela voltar a ficar disponível."
Write-Host ""
Write-Host "Executando a primeira coleta agora..."
Start-ScheduledTask -TaskName $TaskName
Write-Host "A primeira execução foi iniciada em segundo plano."
