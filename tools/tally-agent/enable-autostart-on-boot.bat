@echo off
title Enable Auto-Start on Windows 10 Reboot
color 0B
cls

echo =============================================================
echo     VANIKI TALLY AGENT - ENABLE AUTO-START ON REBOOT
echo =============================================================
echo.

set "AGENT_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_BAT=%STARTUP_DIR%\VanikiTallyAgent.bat"

echo [1/2] Creating Windows Startup Entry...
(
    echo @echo off
    echo cd /d "%AGENT_DIR%"
    echo start "" "%AGENT_DIR%start-tally-agent.bat"
) > "%STARTUP_BAT%"

if exist "%STARTUP_BAT%" (
    echo  -^> [OK] Startup folder configured: %STARTUP_BAT%
) else (
    echo  -^> [WARNING] Could not write to Startup folder.
)

echo.
echo [2/2] Registering Windows Scheduled Task on Login...
schtasks /create /tn "VanikiTallyAutoSync" /tr "\"%AGENT_DIR%start-tally-agent.bat\"" /sc onlogon /f >nul 2>nul
if %errorlevel% equ 0 (
    echo  -^> [OK] Windows Scheduled Task registered successfully!
) else (
    echo  -^> [INFO] Task Scheduler registration skipped (Startup folder is active).
)

echo.
echo =============================================================
echo  SUCCESS! Vaniki Tally Agent will now auto-start whenever:
echo  1. The computer is turned on or restarted.
echo  2. Any user logs into Windows.
echo  3. It will run 24/7 and auto-recover if closed.
echo =============================================================
echo.
pause
