#!/bin/bash
# Instagram publisher with a temporary PUBLIC https address (free, no account):
#   ./admin/start-public.sh
# 1. serves ONLY this admin/ folder with PHP's built-in server on 127.0.0.1:8765
#    (the rest of the web server stays private)
# 2. opens a Cloudflare quick tunnel to it and prints https://<random>.trycloudflare.com
# Open  <that link>/index.html  to publish: api.php uses that address for photos,
# so public_base_url in config.php can stay empty. Ctrl+C stops both.
# The address changes every time you start it.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8765}"
BIN="$HOME/.local/bin/cloudflared"
if ! command -v cloudflared >/dev/null 2>&1 && [ ! -x "$BIN" ]; then
  echo "Downloading cloudflared (Cloudflare's tunnel program) to $BIN ..."
  mkdir -p "$(dirname "$BIN")"
  curl -fL -o "$BIN" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x "$BIN"
fi
CF="$(command -v cloudflared || echo "$BIN")"
mkdir -p "$DIR/media"
php -S 127.0.0.1:$PORT -t "$DIR" >/dev/null 2>&1 &
PHP_PID=$!
trap 'kill $PHP_PID 2>/dev/null' EXIT
sleep 1
echo "Starting the public link (takes ~10 s). Look for: https://....trycloudflare.com"
echo "Then open:  https://....trycloudflare.com/index.html"
"$CF" tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" 2>&1 | grep --line-buffered -oE "https://[a-z0-9-]+\.trycloudflare\.com" | while read -r u; do
  echo ""; echo "  ✅ Admin (Instagram publisher):  $u/index.html"; echo "  Keep this window open while you post. Ctrl+C to stop."; echo ""
done
