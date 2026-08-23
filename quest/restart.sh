#!/bin/sh
# Restart Indilingo on Mac + Quest (USB adb reverse).
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
PORT="${1:-3000}"

if ! lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Starting server on port $PORT…"
  nohup sh "$ROOT/quest/package/run.sh" >/tmp/indilingo-$PORT.log 2>&1 &
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf "http://127.0.0.1:$PORT/quest" >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi

if curl -sf "http://127.0.0.1:$PORT/quest" >/dev/null 2>&1; then
  echo "Mac OK → http://localhost:$PORT/quest"
else
  echo "Mac server failed. Log: /tmp/indilingo-$PORT.log"
  tail -20 "/tmp/indilingo-$PORT.log" 2>/dev/null || true
  exit 1
fi

sh "$ROOT/quest/wire.sh" "$PORT"
