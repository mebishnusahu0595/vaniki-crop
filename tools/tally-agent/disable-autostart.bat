@echo off
title Disable Auto-Start on Windows 10
color 0C
chcp 65001 >nul
cls

echo =============================================================
echo   🌾 VANIKI TALLY AGENT - DISABLE AUTO-START
echo =============================================================
echo.

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_BAT=%STARTUP_DIR%\VanikiTallyAgent.bat"

if exist "%STARTUP_BAT%" (
    del "%STARTUP_BAT%"
    echo [OK] Removed from Windows Startup folder.
)

schtasks /delete /tn "VanikiTallyAutoSync" /f >nul 2>nul
echo [OK] Removed from Windows Task Scheduler.

echo.
echo Auto-start has been disabled.
echo.
pause
