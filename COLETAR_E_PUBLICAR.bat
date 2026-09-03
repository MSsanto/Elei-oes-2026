@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo ELEICOES 2026 - COLETA E PUBLICACAO
echo ============================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\coletar_e_publicar.ps1"
set EXITCODE=%ERRORLEVEL%

echo.
if "%EXITCODE%"=="0" (
  echo Processo concluido com sucesso.
) else (
  echo O processo terminou com erro. Consulte .collector\logs.
)
echo.
pause
exit /b %EXITCODE%
