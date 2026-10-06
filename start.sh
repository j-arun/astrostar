#!/usr/bin/env bash
# ===============================================================================
# VEDIC HOROSCOPE & EPHEMERIS SYSTEM - DUAL LAUNCHER (start.sh)
# ===============================================================================

echo "==============================================================================="
echo "       VEDIC HOROSCOPE SYSTEM - DUAL LAUNCHER (start.sh)"
echo "==============================================================================="

# Find Python 3 binary
if command -v python3 &> /dev/null; then
    PYTHON_BIN="python3"
elif command -v python &> /dev/null; then
    PYTHON_BIN="python"
elif command -v py &> /dev/null; then
    PYTHON_BIN="py"
else
    echo "[ERROR] python3 could not be found! Please install Python 3.8+."
    exit 1
fi

echo ""
echo "[1/3] Checking prerequisites..."
echo "  - $($PYTHON_BIN --version) detected ($PYTHON_BIN)."

if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm could not be found! Please install Node.js 18+."
    exit 1
fi
echo "  - Node $(node --version) / npm $(npm --version) detected."

# Trap Ctrl+C to kill background processes cleanly
trap cleanup SIGINT SIGTERM

cleanup() {
    echo ""
    if [ -n "$API_PID" ]; then
        echo "[SHUTDOWN] Stopping background REST API server (PID: $API_PID)..."
        kill "$API_PID" 2>/dev/null
    fi
    exit 0
}

echo ""
echo "==============================================================================="
echo "[2/3] Starting Python REST API Service on port 5000..."
echo "==============================================================================="

# Check if port 5000 is already listening
if nc -z 127.0.0.1 5000 2>/dev/null || curl -s http://127.0.0.1:5000/api/health &>/dev/null; then
    echo "  - Python REST API is already running on port 5000."
else
    $PYTHON_BIN run_api_server.py &
    API_PID=$!
    echo "  - Process ID:   $API_PID"
    sleep 1
fi

echo "  - REST Endpoint: http://localhost:5000/api/horoscope/query"
echo "  - Health Check:  http://localhost:5000/api/health"

echo ""
echo "==============================================================================="
echo "[3/3] Starting React / Vite UI Frontend on port 3000..."
echo "==============================================================================="
echo "  - Web UI:       http://localhost:3000"
echo "  - Press Ctrl+C in this console to stop both services cleanly."
echo "==============================================================================="
echo ""

npm run dev
