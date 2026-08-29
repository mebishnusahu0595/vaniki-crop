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
    echo After installing, double-click this start-tally-agent.bat again.
    echo.
    pause
    exit /b
)

echo [OK] Node.js is detected!
echo [INFO] Connecting to Tally on Port 9000...
echo [INFO] Starting Vaniki Tally Sync Agent...
echo.

node "%~dp0vaniki-tally-sync.js"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Agent stopped with error.
    pause
)
