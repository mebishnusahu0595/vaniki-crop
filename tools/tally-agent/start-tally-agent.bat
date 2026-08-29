@echo off
setlocal enabledelayedexpansion
title Vaniki Crop Science - Tally Auto-Sync Agent
color 0A
cls

echo =============================================================
echo       VANIKI CROP SCIENCE - TALLY AUTO-SYNC AGENT
echo =============================================================
echo.

set "NODE_EXEC=node"

:: Check if system Node.js is installed
where node >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_EXEC=node"
    echo [OK] System Node.js detected.
) else (
    :: Check if local portable node.exe exists
    if exist "%~dp0node.exe" (
        set "NODE_EXEC=%~dp0node.exe"
        echo [OK] Portable Node.js runtime detected.
    ) else (
        echo [INFO] Node.js is not installed on this PC.
        echo [INFO] Auto-downloading portable Node.js runtime (one-time setup)...
        echo.
        powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://nodejs.org/dist/v20.18.0/win-x64/node.exe', '%~dp0node.exe')"
        if exist "%~dp0node.exe" (
            set "NODE_EXEC=%~dp0node.exe"
            echo.
            echo [OK] Portable Node.js downloaded successfully!
        ) else (
            color 0C
            echo.
            echo [ERROR] Auto-download failed. Please install Node.js from https://nodejs.org/
            pause
            exit /b
        )
    )
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

echo.
echo [INFO] Connecting to Tally on Port 9000...
echo [INFO] Starting Vaniki Tally Sync Agent...
echo.

:: Watchdog loop: If it ever stops, restart in 5 seconds
:loop
"%NODE_EXEC%" "%~dp0vaniki-tally-sync.js"

echo.
echo [WARNING] Agent process stopped. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
cls
goto loop
