@echo off
title Vaniki Crop Science - Tally Auto-Sync Agent
color 0A
chcp 65001 >nul
cls

echo =============================================================
echo      🌾 VANIKI CROP SCIENCE - TALLY AUTO-SYNC AGENT
echo =============================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed on this Windows PC!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/ (LTS Version)
    echo.
    echo After installing Node.js, run this file again.
    echo.
    pause
    exit /b
)

:: Auto-add shortcut to Windows Startup folder if not already present
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_DIR%\VanikiTallyAgent.bat"

if not exist "%SHORTCUT_PATH%" (
    echo [AUTO-START] Configuring Auto-Start on PC Reboot...
    (
        echo @echo off
        echo cd /d "%~dp0"
        echo start "" "%~dp0start-tally-agent.bat"
    ) > "%SHORTCUT_PATH%"
    echo [AUTO-START] Successfully registered! Will auto-start on every PC boot.
    echo.
)

echo [OK] Node.js is active!
echo [INFO] Connecting to Tally on Port 9000...
echo [INFO] Starting Vaniki Tally Sync Agent (Watchdog Loop Enabled)...
echo.

:: Watchdog loop: If it ever stops or gets killed, restart in 5 seconds
:loop
node "%~dp0vaniki-tally-sync.js"

echo.
echo [WARNING] Agent process stopped. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
cls
goto loop
