#!/bin/bash
set -e

echo "Starting IRSForge development environment..."

# Start Canton sandbox + JSON API
echo "Starting Canton sandbox..."
cd "$(dirname "$0")/../contracts" && daml start &
CANTON_PID=$!

# Wait for sandbox to be ready
echo "Waiting for Canton to start..."
sleep 15

# Start oracle service
echo "Starting oracle service..."
cd "$(dirname "$0")/../oracle" && npm run dev &
ORACLE_PID=$!

# Start frontend
echo "Starting frontend..."
cd "$(dirname "$0")/../app" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "IRSForge running:"
echo "  Canton Ledger API: http://localhost:6865"
echo "  Canton JSON API:   http://localhost:7575"
echo "  Frontend:          http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"

trap "kill $CANTON_PID $ORACLE_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
