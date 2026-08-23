#!/bin/sh
# Expose the packaged (or docker) app on HTTPS for Quest Wi‑Fi / Bubblewrap HOST_URL.
# Uses Cloudflare quick tunnel if cloudflared is installed; else prints ngrok hint.
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
PORT="${PORT:-3000}"

# Ensure something is listening
if ! curl -sf "http://127.0.0.1:${PORT}/quest" >/dev/null 2>&1; then
  echo "Nothing on :${PORT}. Start the full package in another terminal:"
  echo "  sh quest/package/run.sh"
  echo "  # or: docker compose up --build"
  exit 1
fi

if command -v cloudflared >/dev/null 2>&1; then
  echo "Tunneling http://127.0.0.1:${PORT} → public HTTPS (Ctrl+C to stop)"
  echo "Use the https://….trycloudflare.com URL as HOST_URL for apk.sh / Quest Browser."
  exec cloudflared tunnel --url "http://127.0.0.1:${PORT}"
fi

if command -v ngrok >/dev/null 2>&1; then
  exec ngrok http "$PORT"
fi

echo "Install a tunnel, then re-run:"
echo "  brew install cloudflare/cloudflare/cloudflared"
echo "  # or: brew install ngrok"
echo ""
echo "Then:"
echo "  sh quest/package/tunnel.sh"
echo "  HOST_URL=https://….trycloudflare.com sh quest/package/apk.sh"
exit 1
