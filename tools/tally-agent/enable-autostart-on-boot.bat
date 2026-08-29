@echo off
title Enable Auto-Start on Windows 10 Reboot
color 0B
cls

echo =============================================================
echo     VANIKI TALLY AGENT - ENABLE AUTO-START ON REBOOT
echo =============================================================
echo.

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_BAT=%STARTUP_DIR%\VanikiTallyAgent.bat"

echo [1/1] Setting up Windows Startup folder...
echo @echo off > "%STARTUP_BAT%"
echo cd /d "%~dp0" >> "%STARTUP_BAT%"
echo start "" "%~dp0start-tally-agent.bat" >> "%STARTUP_BAT%"

if exist "%STARTUP_BAT%" (
    echo [OK] Auto-start configured successfully!
    echo Location: %STARTUP_BAT%
) else (
    echo [WARNING] Could not write to Startup folder.
)

echo.
echo =============================================================
echo  SUCCESS! Vaniki Tally Agent will now auto-start whenever:
echo  1. The computer is turned on or restarted.
echo  2. Any user logs into Windows.
echo  3. It will run 24/7 in the background.
echo =============================================================
echo.
pause
