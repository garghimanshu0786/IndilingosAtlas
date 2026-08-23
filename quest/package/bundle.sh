#!/bin/sh
# Package the ENTIRE Indilingo app (Next standalone + API routes + .env) into one folder/tarball.
# Same idea as Chainlit Docker: one shippable unit that runs with your keys.
# Quest APK is a thin shell — build it with apk.sh after this (or after deploy).
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/quest/package/dist"
STAMP="$(date +%Y%m%d-%H%M%S)"
NAME="indilingo-full-${STAMP}"
DEST="$OUT/$NAME"

cd "$ROOT"

echo "==> production build (standalone)"
npm run build

echo "==> assemble bundle at $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"

# Next standalone server
cp -R "$ROOT/.next/standalone/." "$DEST/"
mkdir -p "$DEST/.next/static" "$DEST/public"
cp -R "$ROOT/.next/static/." "$DEST/.next/static/"
cp -R "$ROOT/public/." "$DEST/public/"

# Env is runtime-only — never bake keys into the tarball.
if [ -f "$ROOT/.env.local" ]; then
  echo "==> skipping .env.local bake (use INDILINGO_API_* at run time)"
fi

cat > "$DEST/run.sh" <<'RUN'
#!/bin/sh
set -e
cd "$(dirname "$0")"
export NODE_ENV=production
# Do not inherit macOS HOSTNAME (machine name) — Next binds on this var.
export HOSTNAME="${BIND_HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"
# Next standalone loads .env.production.local from this directory (baked by bundle.sh).
echo "Indilingo full package on http://${HOSTNAME}:${PORT}/  (Quest: /quest)"
exec node server.js
RUN
chmod +x "$DEST/run.sh"

TAR="$OUT/${NAME}.tgz"
mkdir -p "$OUT"
tar -C "$OUT" -czf "$TAR" "$NAME"

# Pointer for apk / run scripts
ln -sfn "$NAME" "$OUT/current"
ln -sfn "${NAME}.tgz" "$OUT/latest.tgz"

echo ""
echo "PACKAGED (entire app + keys):"
echo "  folder: $DEST"
echo "  tarball: $TAR"
echo ""
echo "Run on this Mac (or any Node 22 host):"
echo "  sh $DEST/run.sh"
echo "  # or: sh quest/package/run.sh"
echo ""
echo "Then Quest:"
echo "  USB:  sh quest/wire.sh  →  http://localhost:3000/quest"
echo "  APK:  HOST_URL=https://your.host sh quest/package/apk.sh"
echo ""
