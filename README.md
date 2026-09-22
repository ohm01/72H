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

## Moving the project (e.g. to SSD)
All runtime data lives inside the project directory, so a move is:
```bash
docker compose down
sudo rsync -aHAX /srv/72h/ /mnt/ssd/72h/
sudo mv /srv/72h /srv/72h.old && sudo ln -s /mnt/ssd/72h /srv/72h
cd /srv/72h && docker compose up -d
# verify, then: sudo rm -rf /srv/72h.old
```

## App
Metro runs on the Mac (the RPi has too little RAM):
```bash
git clone <repo> && cd 72h/app && npm install
npx expo start --dev-client
```
Dev builds: `npx eas-cli build --profile development` (phone) or `development-simulator` (iOS Simulator).
Translations: `app/i18n/locales/<lang>.json`.

## Backup and restore
TBD (M7).
