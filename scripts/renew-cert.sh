#!/usr/bin/env bash
set -euo pipefail

DOMAIN="my-server.abc123de.ts.net"
APP_DIR="/home/youruser/maintenance-tracker"
CERT="$APP_DIR/certs/cert.pem"
KEY="$APP_DIR/certs/key.pem"

before=$(sha256sum "$KEY" 2>/dev/null || true)

tailscale cert --cert-file "$CERT" --key-file "$KEY" --min-validity 720h "$DOMAIN"

chmod 644 "$CERT"
chmod 600 "$KEY"

after=$(sha256sum "$KEY")

if [ "$before" != "$after" ]; then
  echo "Cert renewed, restarting maintenance-tracker.service"
  systemctl --user restart maintenance-tracker.service
else
  echo "Cert unchanged, no restart needed"
fi
