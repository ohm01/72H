#!/usr/bin/env bash
# Creates ~/72h/.env on the server with fresh random secrets (never leaves the server). Run once, on the server.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && { echo ".env already exists – not touching it"; exit 0; }
umask 077
cat > .env <<ENV
POSTGRES_DB=app72h
POSTGRES_USER=app72h
POSTGRES_PASSWORD=$(openssl rand -hex 24)
API_PUBLIC_URL=https://api.rodinnapripravenost.com
# Local CZ extract (scripts/fetch-cz-map.sh); until then a Protomaps build URL works too.
MAP_SOURCE=/maps/cz.pmtiles
AUTH_SECRET=$(openssl rand -hex 32)
# log = codes only in the server log. Set brevo/resend + key + sender before real users sign in.
EMAIL_PROVIDER=log
EMAIL_API_KEY=
EMAIL_FROM=
ENV
echo "Created .env (chmod 600). Fill EMAIL_* with: nano ~/72h/.env"
