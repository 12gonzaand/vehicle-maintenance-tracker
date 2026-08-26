#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
source "$APP_DIR/.env"
set +a

if [ -z "${CERT_DOMAIN:-}" ]; then
  echo "CERT_DOMAIN is not set in .env — set it to this node's Tailscale MagicDNS name (see \`tailscale status\`)." >&2
  exit 1
fi

CERT="$APP_DIR/certs/cert.pem"
KEY="$APP_DIR/certs/key.pem"

before=$(sha256sum "$KEY" 2>/dev/null || true)

tailscale cert --cert-file "$CERT" --key-file "$KEY" --min-validity 720h "$CERT_DOMAIN"

chmod 644 "$CERT"
chmod 600 "$KEY"

after=$(sha256sum "$KEY")

if [ "$before" != "$after" ]; then
  echo "Cert renewed, restarting maintenance-tracker.service"
  systemctl --user restart maintenance-tracker.service
else
  echo "Cert unchanged, no restart needed"
fi
