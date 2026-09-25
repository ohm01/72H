#!/usr/bin/env bash
# Nightly PostgreSQL dump into ~/backups, keeps 14 days (cron, see deploy/cloud-init.yaml).
# Restore: see docs/DEPLOY.md.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
# Dumps contain account emails: owner-only files.
umask 077
DIR=${BACKUP_DIR:-$HOME/backups}
mkdir -p "$DIR"
file="$DIR/72h-$(date +%Y%m%d-%H%M).dump"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$file.part"
mv "$file.part" "$file"
find "$DIR" -name '72h-*.dump' -mtime +13 -delete
echo "$(date '+%F %T') backup ok: $file ($(du -h "$file" | cut -f1))"
