#!/usr/bin/env bash
# Creates the production server on Hetzner Cloud (run on the Mac; needs `hcloud context create 72h`).
# Usage: scripts/create-server.sh [type] [location]   default: cax11 hel1
set -euo pipefail
cd "$(dirname "$0")/.."
TYPE=${1:-cax11}
LOCATION=${2:-hel1}
NAME=72h-prod

# Both public keys (deploy key + personal key) become authorized keys of the `app` user.
keys=""
for k in ~/.ssh/id_ed25519_72h_vps.pub ~/.ssh/id_ed25519.pub; do
  [ -f "$k" ] && keys+="      - $(cat "$k")"$'\n'
done
[ -n "$keys" ] || { echo "no SSH public key found"; exit 1; }
userdata=$(mktemp)
trap 'rm -f "$userdata"' EXIT
python3 - "$userdata" "$keys" <<'PY'
import sys
out, keys = sys.argv[1], sys.argv[2]
open(out, "w").write(open("deploy/cloud-init.yaml").read().replace("__SSH_KEYS__\n", keys))
PY

hcloud server create --name "$NAME" --type "$TYPE" --image ubuntu-24.04 --location "$LOCATION" \
  --ssh-key 72h-vps-deploy --ssh-key jan-mac --firewall 72h-ssh --user-data-from-file "$userdata"
hcloud server enable-backup "$NAME"
echo "IP: $(hcloud server ip "$NAME")  – first boot takes a few minutes (cloud-init)."
echo "Check: ssh app@$(hcloud server ip "$NAME") cloud-init status --wait"
