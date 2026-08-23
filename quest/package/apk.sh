#!/bin/sh
# Build + sideload Meta Quest PWA APK (Bubblewrap TWA) pointing at a hosted Indilingo URL.
# The APK is a shell — the full app (keys, LingBot tokens, Live) lives on HOST_URL.
#
# Prerequisites:
#   1. Host the full package somewhere HTTPS (Vercel, docker compose + tunnel, etc.)
#   2. npm install -g @meta-quest/bubblewrap-cli
#   3. Quest Developer Mode + adb
#
# Usage:
#   HOST_URL=https://indilingo.example.com sh quest/package/apk.sh
#   HOST_URL=https://… INSTALL=1 sh quest/package/apk.sh   # also adb install
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
PKG="$ROOT/quest/package"
ANDROID="$PKG/android"
HOST_URL="${HOST_URL:?Set HOST_URL to your HTTPS origin, e.g. https://your-app.vercel.app}"
HOST_URL="${HOST_URL%/}"
PACKAGE_ID="${PACKAGE_ID:-com.indilingo.quest}"
APP_NAME="${APP_NAME:-Indilingo Quest}"

if ! command -v bubblewrap >/dev/null 2>&1; then
  echo "Installing @meta-quest/bubblewrap-cli…"
  npm install --global @meta-quest/bubblewrap-cli
fi

mkdir -p "$ANDROID"
cd "$ANDROID"

MANIFEST_URL="${HOST_URL}/manifest.webmanifest"
echo "==> Bubblewrap from $MANIFEST_URL"

# Non-interactive project if missing
if [ ! -f twa-manifest.json ]; then
  cat > twa-manifest.json <<EOF
{
  "packageId": "${PACKAGE_ID}",
  "name": "${APP_NAME}",
  "launcherName": "Indilingo",
  "display": "standalone",
  "themeColor": "#7ED0C0",
  "themeColorDark": "#141414",
  "navigationColor": "#7ED0C0",
  "navigationColorDark": "#141414",
  "navigationDividerColor": "#7ED0C0",
  "navigationDividerColorDark": "#141414",
  "backgroundColor": "#7ED0C0",
  "enableNotifications": false,
  "startUrl": "/quest",
  "iconUrl": "${HOST_URL}/icons/icon-512.png",
  "maskableIconUrl": "${HOST_URL}/icons/icon-512.png",
  "splashScreenFadeOutDuration": 300,
  "signingKey": {
    "path": "${PKG}/indilingo-quest.keystore",
    "alias": "indilingo"
  },
  "appVersionName": "1.0.0",
  "appVersionCode": 1,
  "shortcuts": [],
  "generatorApp": "bubblewrap-cli",
  "webManifestUrl": "${MANIFEST_URL}",
  "fallbackType": "customtabs",
  "features": {},
  "alphaDependencies": { "enabled": false },
  "enableSiteSettingsShortcut": false,
  "isChromeOSOnly": false,
  "isMetaQuest": true,
  "horizonOSAppMode": "2D",
  "fullScopeUrl": "${HOST_URL}/",
  "minSdkVersion": 26,
  "orientation": "landscape",
  "fingerprints": [],
  "additionalTrustedOrigins": [],
  "retainedFragments": [],
  "protocolHandlers": [],
  "fileHandlers": [],
  "launchHandlerClientMode": ""
}
EOF
  echo "Wrote twa-manifest.json (2D Quest panel — Enter VR still works inside /quest)."
fi

# Create keystore once
KEYSTORE="$PKG/indilingo-quest.keystore"
if [ ! -f "$KEYSTORE" ]; then
  echo "==> creating signing keystore at $KEYSTORE"
  PASS="${KEYSTORE_PASS:-indilingo-quest-dev}"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias indilingo \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" \
    -dname "CN=Indilingo Quest, OU=Dev, O=Indilingo, L=Local, ST=NA, C=US"
fi

PASS="${KEYSTORE_PASS:-indilingo-quest-dev}"
export BUBBLEWRAP_KEYSTORE_PASSWORD="$PASS"
export BUBBLEWRAP_KEY_PASSWORD="$PASS"

echo "==> bubblewrap update + build"
# Prefer update from live manifest when host is reachable
bubblewrap update --manifest="$MANIFEST_URL" 2>/dev/null || true
bubblewrap build

APK="$(ls -1 app-release-signed.apk 2>/dev/null || ls -1 *.apk 2>/dev/null | head -1 || true)"
if [ -z "$APK" ]; then
  echo "Build finished but no APK found in $ANDROID — check bubblewrap output."
  exit 1
fi
cp -f "$APK" "$PKG/indilingo-quest.apk"
echo "==> APK: $PKG/indilingo-quest.apk"

# Publish fingerprint into repo assetlinks for the next host deploy
if command -v keytool >/dev/null 2>&1; then
  FP="$(keytool -list -v -keystore "$KEYSTORE" -alias indilingo -storepass "$PASS" 2>/dev/null \
    | awk '/SHA256:/{print $2; exit}')"
  if [ -n "$FP" ]; then
    echo "==> SHA-256 fingerprint: $FP"
    cat > "$ROOT/public/.well-known/assetlinks.json" <<EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "${PACKAGE_ID}",
      "sha256_cert_fingerprints": ["${FP}"]
    }
  }
]
EOF
    echo "Updated public/.well-known/assetlinks.json — redeploy HOST_URL so Quest trusts the APK."
  fi
fi

if [ "${INSTALL:-0}" = "1" ]; then
  echo "==> adb install"
  adb install -r "$PKG/indilingo-quest.apk"
  echo "Open from Unknown Sources on the Quest."
fi

echo ""
echo "Done. APK opens ${HOST_URL}/quest"
echo "Keys stay on the server package (bundle/docker), not inside the APK."
