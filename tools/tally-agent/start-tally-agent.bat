@echo off
title Vaniki Crop Science - Tally Auto-Sync Agent
color 0A
cls

echo =============================================================
echo       VANIKI CROP SCIENCE - TALLY AUTO-SYNC AGENT
echo =============================================================
echo.

cd /d "%~dp0"

:: Check if Node.js exists
set "NODE_CMD=node"

where node >nul 2>nul
if %errorlevel% equ 0 goto start_agent

if exist "%~dp0node.exe" (
    set "NODE_CMD=%~dp0node.exe"
    goto start_agent
)

echo [INFO] Node.js is not installed on this PC.
echo [INFO] Auto-downloading portable Node.js runtime (one-time setup)...
echo.

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://nodejs.org/dist/v20.18.0/win-x64/node.exe', '%~dp0node.exe')"

if exist "%~dp0node.exe" (
    set "NODE_CMD=%~dp0node.exe"
    echo [OK] Portable Node.js downloaded successfully!
    goto start_agent
)

color 0C
echo.
echo [ERROR] Could not auto-download Node.js.
echo Please download and install Node.js manually from:
echo https://nodejs.org/ (LTS Version)
echo.
pause
exit /b

:start_agent
echo [OK] Node.js runtime ready: %NODE_CMD%
echo [INFO] Connecting to Tally on Port 9000...
echo [INFO] Starting Vaniki Tally Sync Agent...
echo.

:loop
"%NODE_CMD%" "%~dp0vaniki-tally-sync.js"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Agent stopped with code %errorlevel%.
    echo Check tally-agent.log for details.
    echo Press any key to retry, or wait 10 seconds...
    timeout /t 10
)
goto loop
