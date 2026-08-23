#!/bin/sh
# Quest over Wi‑Fi: HTTPS on your Mac's LAN IP (secure context for mic + WebXR).
# USB + adb reverse is still easier when the cable works: sh quest/wire.sh
set -e
PORT="${1:-3000}"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

if [ -z "$IP" ]; then
  echo "Could not read a Wi‑Fi IP. Connect this Mac to Wi‑Fi first."
  exit 1
fi

echo "Wi‑Fi path (Quest Browser on the same network):"
echo ""
echo "  1. On this Mac, start HTTPS dev (listens on all interfaces):"
echo "     npx next dev --experimental-https -H 0.0.0.0 --port ${PORT}"
echo "     (Restart after IP changes — next.config.ts allowlists this Mac's LAN IP for Quest chunks.)"
echo ""
echo "  2. On the Quest, open Quest Browser:"
echo "     https://${IP}:${PORT}/quest"
echo ""
echo "  3. Accept the certificate warning once."
echo ""
echo "Mic and Enter VR need HTTPS. Plain http://${IP}:${PORT} will load but block mic/VR."
echo ""
echo "If the page never loads, event Wi‑Fi may isolate devices — use USB:"
echo "  sh quest/wire.sh"
