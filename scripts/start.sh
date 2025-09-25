#!/usr/bin/env bash
set -euo pipefail
PORT="${1:-3000}"
NAME="${2:-staging}"
PID=".${NAME}.pid"
LOG="${NAME}.log"

# Stop previous if running
if [ -f "$PID" ]; then
  P=$(cat "$PID" || :)
  if [ -n "${P}" ] && ps -p "${P}" >/dev/null 2>&1; then
    echo "Stopping previous ${NAME} (PID ${P})"
    kill -9 "${P}" || true
    sleep 1
  fi
  rm -f "$PID"
fi

echo "Starting ${NAME} on :${PORT}..."
PORT="${PORT}" nohup node server.js > "${LOG}" 2>&1 &
echo $! > "$PID"
echo "${NAME} started. PID=$(cat "$PID"), log=${LOG}"
