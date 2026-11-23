#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "============================================================"
echo " Starting SEVA PASS Rebuilt Full Stack Platform"
echo "============================================================"

# Cleanup function on Ctrl+C
cleanup() {
    echo ""
    echo "[SEVA PASS] Terminating services gracefully..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

# 1. Initialize and Start Backend
echo "[1/2] Launching Backend Service on http://127.0.0.1:8000..."
cd "$DIR/backend"
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
fi

echo "Seeding database with synthetic evaluation records..."
./venv/bin/python3 -m app.seed

echo "Starting FastAPI server..."
./venv/bin/python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be online
echo "Waiting for backend health check..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/api/health > /dev/null; then
        echo "Backend is online and operational!"
        break
    fi
    sleep 0.5
done

# 2. Launch Frontend
echo "[2/2] Launching Frontend Interface on http://localhost:5173..."
cd "$DIR/frontend"
npm run dev -- --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "============================================================"
echo " SEVA PASS Platform Ready!"
echo " Portal URL:    http://localhost:5173"
echo " Backend API:   http://127.0.0.1:8000"
echo " API Docs:      http://127.0.0.1:8000/docs"
echo " Public Verify: http://localhost:5173 (Click 'Verify a Pass')"
echo "============================================================"
echo "Press Ctrl+C to stop all services."

wait
