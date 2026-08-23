#!/bin/sh
# Run the packaged full app (build first if missing).
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
CUR="$ROOT/quest/package/dist/current"

if [ ! -x "$CUR/run.sh" ]; then
  echo "No bundle yet — packing now…"
  sh "$ROOT/quest/package/bundle.sh"
fi

exec sh "$CUR/run.sh"
