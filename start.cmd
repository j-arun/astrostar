@echo off
setlocal enabledelayedexpansion

title Vedic Horoscope System - Dual Service Launcher

echo ===============================================================================
echo        VEDIC HOROSCOPE & EPHEMERIS SYSTEM - DUAL LAUNCHER (start.cmd)
echo ===============================================================================
echo.
echo [1/3] Checking prerequisites...

set PYTHON_BIN=
where python >nul 2>nul && set PYTHON_BIN=python
if not defined PYTHON_BIN (
    where py >nul 2>nul && set PYTHON_BIN=py
)
if not defined PYTHON_BIN (
    where python3 >nul 2>nul && set PYTHON_BIN=python3
)

if not defined PYTHON_BIN (
    echo [ERROR] Python not found in PATH! Please install Python 3.8+ from python.org or add it to your PATH.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('%PYTHON_BIN% --version 2^>^&1') do set PYTHON_VER=%%i
echo   - %PYTHON_VER% detected (%PYTHON_BIN%).

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
echo [2/3] Starting Python REST API Service (Port 5000)...
echo ===============================================================================
start "Vedic REST API Server (:5000)" cmd /k "title Vedic REST API :5000 && echo Starting Python REST API on port 5000... && %PYTHON_BIN% run_api_server.py"

echo   - Process launched in dedicated window: "Vedic REST API Server (:5000)"
echo   - Endpoint:     http://localhost:5000/api/horoscope/query
echo   - Health Check: http://localhost:5000/api/health
echo   - Mode:         Standalone / Fallback Active
echo.

echo ===============================================================================
echo [3/3] Starting React / Vite UI Frontend (Port 3000)...
echo ===============================================================================
echo   - Web URL:      http://localhost:3000
echo   - Mode:         Interactive Monthly Transit & Backtesting Engine
echo.
echo Press Ctrl+C in this console to stop the UI.
echo ===============================================================================
echo.

call npm run dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [NOTICE] If port 3000 is occupied, you can launch both services concurrently using:
    echo   node scripts/start-all.js
    pause
)
