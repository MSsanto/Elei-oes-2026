Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$TaskName = "Eleicoes2026-Coletor-TSE"
$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if (-not $Task) {
    Write-Host "A tarefa $TaskName não está instalada."
    exit 0
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Agendamento removido com sucesso." -ForegroundColor Green
