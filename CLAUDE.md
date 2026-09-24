# 72h – Family Preparedness

Project memory for Claude Code. Keep short and current.

## Product
Freemium app for family crisis preparedness (blackout, floods, network outage). Calm, practical tone, no fear-mongering.
Store name: "72h – Rodinná připravenost" – **CZ store listing only (user 2026-09-24)**; other markets (SK/PL/FI, EN) get their own localized names, TBD. FI: "72 tuntia" is the national preparedness recommendation (SPEK, funded by Huoltovarmuuskeskus) → avoid a "72h" name that looks official there too. Must NOT look like an official state app (72h.gov.cz), no state logos.

Tabs: **Zásoby** (locations, items with expiry, readiness in days, CZ checklist) · **Mapa** (offline OSM map, meeting points, arrow + distance, last family location – Plus) · **Rodina** (members, QR/link invite, optional location sharing – Plus) · **Více** (country comparison, go-bag, contacts, subscription, settings, language).
Onboarding: people + pets → first stock location → meeting point (skippable).
**Proposals 2026-09-23 (user, not critical → later milestones, details in `docs/PROGRESS.md`):** done: home food list + emergency bag (opt-in location with packing guide, `data/guides.json`; must not count toward Free location limit in M4); family contacts (local, Rodina tab + kids screen; sync in M3); next:, 4 household adults/children/babies + baby items shown only if babies > 0 (M5), 5 parent/child roles (M3), 6 food by kcal + variety (M5).
**Simplicity rule (user):** add new features as opt-in options with guidance inside, not extra links on main screens.
Languages: cs + en via i18next, no hardcoded UI strings. **CHANGE 2026-09-22 (user):** also sk, pl, fi (target countries) – machine-translated, need native review before release.

## Tiers (config constants in one place)
| | Free | Plus (100 Kč/yr · Supporter 249 Kč/yr · Lifetime 299 Kč) |
|---|---|---|
| Family members (sync) | 4 | 8 |
| Stock items | 30 | unlimited |
| Stock locations | 1 | unlimited |
| Meeting points | 1 | unlimited |
| Offline map areas | 1 (≤500 km²) | 5 (≤5 000 km²) |
| Map downloads / month | 2 | 10 |
| Expiry reminders | no | yes |
| Last family location | visible w/ Plus badge → paywall | yes, opt-in |
Checklist, country comparison, navigation, kids screen: free.
Product IDs `72h.plus.yearly`, `72h.supporter.yearly`, `72h.lifetime` → all grant entitlement `plus`.
Show usage + reset date. Paywall only on attempt to use a Plus feature, always specific. Never on launch.

## Key decisions
- Maps: OpenStreetMap only (no Google). CZ only in 1.0. One CZ PMTiles file extracted from a Protomaps build (`pmtiles extract` with CZ bbox). Server cuts user area, limits checked server-side.
- Auth: email + one-time code. **CHANGE 2026-09-22 (user):** also SSO – Google + Sign in with Apple (Apple guideline 4.8 requires Apple when Google is offered); other providers TBD at M3. Server verifies provider ID tokens (JWKS), no third-party auth service.
- Family key generated on device, shared only via invite (QR/link). Server never sees it. Sync: last write wins.
- Last location: opt-in, off by default, visible when on, ~1×/h or >1 km move, encrypted with family key (libsodium), server keeps only latest ciphertext, deleted on leaving group.
- Legal: GDPR minimal data, EU hosting, export + delete account in app. App is an aid, not an official warning system; emergency 112. OSM attribution (ODbL).
- NOT in 1.0: non-CZ maps, barcodes, continuous tracking, history, geofence, SOS, route navigation, PDF export, widget, B2B, Redis.

## Architecture
- `app/` Expo (RN, TypeScript), Expo Router, expo-sqlite (offline-first), expo-notifications, expo-location + task-manager, MapLibre RN, i18next, react-native-libsodium, RevenueCat. Dev builds via EAS (profiles `development`, `development-simulator`).
- `server/` Python FastAPI + PostgreSQL, Docker Compose. API port 8000, DB local only. Emails via Brevo/Resend.
- `data/countries/` recommendation JSON per country (CZ, SK, PL, FI).
- `maps/` map files (not in git). `docs/` plan, threat model, store texts.
- Public access: Cloudflare Tunnel, hostname `api.jennase.org` → localhost:8000.

## Environment & constraints
- Raspberry Pi (aarch64), **905 MB RAM + 904 MB swap**, shared with Rodinná E-knihovna.
- **Do not touch the library:** Flask on port 80, files/git/CLAUDE.md in `/home/ohm`. Don't use port 80, don't install/configure anything in `/home/ohm`.
- Project in `/srv/72h`. Until M2 on SD card (minimize writes). Before M3: move to SSD, `/srv/72h` → symlink to `/mnt/ssd/72h`, Docker data too.
- User works from Mac via VS Code Remote SSH; iOS Simulator on Mac.

## Working rules
1. Plan before each milestone, wait for "OK". Inside an approved milestone don't ask needlessly.
2. Minimal targeted changes. Complete files. Simplest thing that works; justify any extra complexity.
3. Chat in Czech, concise. Code + comments in English.
4. Secrets only in `.env` (gitignored).
5. End of milestone: explain how to verify "Done when".
6. **Never run `sudo`** – print commands for the user.
7. Logins (GitHub, Expo, Apple, Google) done by the user – say exactly what/where, then wait.
8. Git: after each approved step commit (`feat:`/`fix:`/`docs:`/`chore:`, English) + push. Check `git status` first. Never commit `.env`, keys, DB, map files, `node_modules`.

## Milestones
- [ ] **M0 Setup** – env check, skeleton, git/GitHub, Docker Compose (/health), Expo 4 tabs + i18n, EAS dev builds, Cloudflare Tunnel, backup check. *Done:* app with 4 tabs runs on phone/simulator, `https://api.<domain>/health` OK, code on GitHub.
- [ ] **M1 Stock offline** – locations, items, expiry colors, readiness, CZ checklist, onboarding, reminders. *Done:* stock at home + cottage, reminder arrives.
- [ ] **M2 Map & meeting points** – CZ PMTiles, cut endpoint w/ limits, area select, download w/ progress, offline map, GPS, meeting points, arrow, kids screen. *Done:* airplane mode, map visible, arrow leads to meeting point.
- [ ] **M3 Accounts & family** (SSD first) – email OTP, family group, invite w/ key, sync, delete account, export. First Google Play closed-test build. *Done:* second phone sees my changes.
- [ ] **M4 Payments & limits** – RevenueCat, 3 products, webhook, limits app+server, paywalls, usage display. *Done:* sandbox purchase, survives reinstall.
- [ ] **M5 Country comparison** – CZ/SK/PL/FI official sources, JSON, Markdown table for review, screen, standard choice. *Done:* checklist recalculates, sources approved.
- [ ] **M6 Last known location** – threat model + crypto design first. *Done:* in airplane mode I see member's last location with time. Fallback: ship 1.0 without it.
- [ ] **M7 Beta & release** – security, TestFlight, Play closed test, store texts, privacy policy, labels, reviewer notes. *Done:* approved in both stores.

## Status
Human-readable progress (Czech) is in `docs/PROGRESS.md` – update it after every step.

- 2026-09-22: M0 approved. Done: skeleton, GitHub `git@github.com:ohm01/72H.git` (deploy key), .env (local), Docker Compose running, `https://api.jennase.org/health` OK, Expo SDK 57 app with 4 tabs + i18next (cs/en), tsc + expo-doctor OK.
  Cloudflare: tunnel is dashboard-managed (token); geo-block WAF rule scoped to `rejstrik.jennase.org` (library).
  Next: EAS (user logs in), dev builds, backup check.
- Known issue: kernel has no memory cgroup → compose `mem_limit` ignored (needs `cgroup_enable=memory` in cmdline.txt + reboot).
- Decisions: all runtime data inside project dir (`var/`, `maps/`) for easy SSD move. Metro runs on the Mac (RPi RAM too small), RPi = source of truth + server. eas-cli via `npx`, no global install. GitHub access via repo deploy key (not account key).
- App: `app/AGENTS.md` (from Expo template) says to check versioned Expo docs – SDK 57 APIs may differ from training data.
