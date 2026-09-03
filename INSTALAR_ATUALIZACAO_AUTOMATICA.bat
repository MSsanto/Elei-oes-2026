@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo ELEICOES 2026 - INSTALAR ATUALIZACAO AUTOMATICA
echo ============================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\instalar_atualizacao_automatica.ps1"
set EXITCODE=%ERRORLEVEL%

echo.
if "%EXITCODE%"=="0" (
  echo Agendamento configurado.
) else (
  echo Nao foi possivel configurar o agendamento.
  echo Se aparecer erro de permissao, execute este arquivo como Administrador.
)
echo.
pause
exit /b %EXITCODE%
