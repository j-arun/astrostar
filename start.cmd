@echo off
setlocal enabledelayedexpansion

title Vedic Horoscope System - Unified Single-Port Launcher (:3000)

echo ===============================================================================
echo        VEDIC HOROSCOPE & EPHEMERIS SYSTEM - UNIFIED LAUNCHER (start.cmd)
echo ===============================================================================
echo.
echo [1/2] Checking Node.js & npm prerequisites...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found in PATH! Please install Node.js 18+ from nodejs.org.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version 2^>^&1') do set NODE_VER=%%i
echo   - Node.js %NODE_VER% detected.

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    where npm.cmd >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm package manager not found!
        pause
        exit /b 1
    )
)
echo.

echo ===============================================================================
echo [2/2] Starting Unified Web UI + REST API Server (Port 3000)...
echo ===============================================================================
echo   - Web UI:           http://localhost:3000
echo   - Horoscope API:    http://localhost:3000/api/horoscope/query
echo   - Content API:      http://localhost:3000/api/content
echo   - Health Check:     http://localhost:3000/api/health
echo.
echo Press Ctrl+C in this console to stop the unified server.
echo ===============================================================================
echo.

call npm run dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [NOTICE] Server exited with an error. Verify Node.js dependencies via "npm install".
    pause
)
