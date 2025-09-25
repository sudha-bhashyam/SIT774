#!/usr/bin/env bash
set -euo pipefail
NAME="${1:-staging}"
PID=".${NAME}.pid"
if [ -f "$PID" ]; then
  P=$(cat "$PID" || :)
  if [ -n "${P}" ] && ps -p "${P}" >/dev/null 2>&1; then
    echo "Stopping ${NAME} (PID ${P})"
    kill -9 "${P}" || true
  fi
  rm -f "$PID"
else
  echo "No PID file for ${NAME}."
fi
