#!/bin/sh
# Official Meta USB path (docs 22 Jul 2026):
# adb reverse so Quest Browser localhost hits this Mac.
# http://localhost is a secure context — mic + WebXR do not need LAN HTTPS.
set -e
PORT="${1:-3000}"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is missing. brew install android-platform-tools"
  exit 1
fi

echo "Devices:"
adb devices -l

# Prefer USB serial when USB + wireless both show as device (adb needs -s then).
SERIAL="$(
  adb devices -l | awk '
    NR > 1 && $2 == "device" {
      usb = 0
      for (i = 3; i <= NF; i++) if ($i ~ /^usb:/) usb = 1
      if (usb && !picked) { picked = $1; print picked; exit }
      if (!usb && !wifi) wifi = $1
    }
    END { if (!picked && wifi) print wifi }
  '
)"

if [ -z "$SERIAL" ]; then
  echo ""
  echo "Quest 3S is on USB, but ADB is not authorized."
  echo "On the headset: Settings → System → Developer → USB debugging ON."
  echo "Put it on. Tap Allow USB debugging → Always allow."
  echo "Then run: sh quest/wire.sh"
  exit 2
fi

echo "Using device: ${SERIAL}"
ADB="adb -s ${SERIAL}"

$ADB reverse "tcp:${PORT}" "tcp:${PORT}"
echo "Reversed tcp:${PORT} → this Mac"
$ADB reverse --list

# Horizon OS Quest Browser launch activity (WebActivity is gone).
$ADB shell am start -a android.intent.action.VIEW \
  -d "http://localhost:${PORT}/quest" \
  com.oculus.browser/.OculusLauncherActivity 2>/dev/null \
  || $ADB shell am start -a android.intent.action.VIEW \
    -d "http://localhost:${PORT}/quest"

echo ""
echo "On the Quest, open Quest Browser → http://localhost:${PORT}/quest"
echo "Inspect from the Mac: Chrome → chrome://inspect/#devices"
