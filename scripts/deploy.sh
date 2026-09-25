#!/usr/bin/env bash
# Deploys the committed code (HEAD) to the production server and restarts the stack. Run on the Mac.
# .env, var/ (database) and maps/ on the server are never touched.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=${DEPLOY_HOST:-app@$(hcloud server ip 72h-prod)}

if [ -n "$(git status --porcelain)" ]; then
  echo "Note: uncommitted changes are NOT deployed (only HEAD $(git rev-parse --short HEAD))."
fi

git archive --format=tar HEAD | ssh "$HOST" 'rm -rf ~/.deploy && mkdir ~/.deploy && tar -x -C ~/.deploy &&
  rsync -a --delete --exclude=/.env --exclude=/var/ --exclude=/maps/ ~/.deploy/ ~/72h/ && rm -rf ~/.deploy'
ssh "$HOST" 'cd ~/72h && { [ -f .env ] || scripts/server-env.sh; } && docker compose up -d --build &&
  sleep 5 && curl -fsS http://127.0.0.1:8000/health && echo && docker compose ps'
echo "Deployed $(git rev-parse --short HEAD) to $HOST"
