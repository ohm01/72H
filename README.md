# 72h – Family Preparedness

Offline-first family preparedness app (Expo) with a small FastAPI backend.

## Layout
```
app/             Expo app (React Native, TypeScript)
server/          FastAPI backend
data/countries/  Country recommendations (JSON)
maps/            Map files (not in git)
var/             Runtime data, e.g. PostgreSQL (not in git)
docs/            Plan, threat model, store texts
```

## Server
```bash
cp .env.example .env   # fill in secrets
docker compose up -d --build
curl http://localhost:8000/health
```

## Production
Hetzner Cloud server `72h-prod`, API at `https://api.rodinnapripravenost.com` (Cloudflare Tunnel).
Create the server, deploy, maps, backups and restore: see `docs/DEPLOY.md`.
```bash
scripts/deploy.sh   # from the Mac: deploys the committed HEAD
```

## App
Development runs on the Mac (Docker via OrbStack, Metro, iOS Simulator):
```bash
git clone <repo> && cd 72h/app && npm install
npx expo start --dev-client
```
Dev builds: `npx eas-cli build --profile development` (phone) or `development-simulator` (iOS Simulator).
Translations: `app/i18n/locales/<lang>.json`.

## Backup and restore
Nightly database dumps + Hetzner server backups – see `docs/DEPLOY.md`.
