# Průběh projektu 72h

Aktualizuje Claude po každém kroku. Legenda: ✅ hotovo · 🔄 rozpracováno · ⏳ čeká na tebe · ⬜ nezačato · ❌ zrušeno

**Poslední aktualizace:** 2026-09-22

## Kde jsme
- **M0:** skoro hotovo. Chybí EAS buildy (čekají na tvůj `eas login` a bundle ID) a ověření aplikace na telefonu nebo simulátoru.
- **M1:** kód je hotový a testuje se. Na zařízení zatím neověřeno (potřebuje development build).
- **M5:** data 4 zemí jsou připravená ke schválení (`docs/country-comparison.md`), obrazovka srovnání zatím chybí.
- Přidány jazyky SK, PL a FI (strojový překlad, před vydáním potřebuje kontrolu).

## ⏳ Co čeká na tebe
1. `cd /srv/72h/app && npx eas-cli login` (účet expo.dev) a pak mi dej vědět.
2. Rozhodnout bundle ID / package name (návrh `org.jennase.family72h`), po vydání nejde změnit.
3. Schválit zdroje a nejistoty v `docs/country-comparison.md`.
4. Volitelně (restart RPi): zapnout memory cgroup, aby platily limity paměti v Dockeru:
   `sudo sed -i '1 s/$/ cgroup_enable=memory cgroup_memory=1/' /boot/firmware/cmdline.txt && sudo reboot`
5. Volitelně: token cloudflared přesunout z příkazové řádky do souboru s právy 600.
6. Před M3: připojit SSD (postup přesunu je v `README.md`).

## Milníky

### M0 – Příprava 🔄
| Krok | Stav | Poznámka |
|---|---|---|
| 1. Kontrola prostředí | ✅ | 905 MB RAM je málo → Metro poběží na Macu |
| 2. Struktura projektu | ✅ | všechna data uvnitř `/srv/72h` kvůli pozdějšímu přesunu na SSD |
| 3. Git a GitHub | ✅ | `git@github.com:ohm01/72H.git`, deploy key jen pro tento repozitář |
| 4. Docker Compose + /health | ✅ | Postgres 16 + FastAPI, `localhost:8000/health` OK |
| 5. Expo, 4 záložky, i18n | ✅ | SDK 57, cs/en (+ sk/pl/fi) |
| 6. EAS a dev buildy | ⏳ | `eas.json` hotový, čeká na login a bundle ID |
| 7. Cloudflare Tunnel | ✅ | `https://api.jennase.org/health` = 200, geo-blokace jen pro `rejstrik.jennase.org` |
| 8. Záloha | ✅ | kód na GitHubu, `.env` není v gitu. **Ulož si `/srv/72h/.env` do správce hesel.** |
| 9. CLAUDE.md, commit | ✅ | průběžně |

*Hotovo, když:* aplikace se 4 záložkami běží na telefonu nebo v simulátoru ⏳, `https://api…/health` odpovídá ✅, kód je na GitHubu ✅.

### M1 – Zásoby offline 🔄
| Část | Stav |
|---|---|
| Lokality (přidat, přejmenovat, smazat) | ✅ kód |
| Položky: název, typ, množství, jednotka, lokalita, expirace, poznámka | ✅ kód |
| Řazení podle expirace, barvy (červená / oranžová / zelená) | ✅ kód + testy |
| Stav připravenosti (dny celkem i za lokalitu) | ✅ kód + testy |
| Checklist ČR podle 72h.gov.cz, přepočet na osoby a zvířata | ✅ kód + testy |
| Onboarding ve 3 krocích (+ uvítání) | ✅ kód |
| Připomínky expirace 30 a 7 dní předem (Plus; ve vývojovém buildu zapnuté) | ✅ kód + testy |
| cs + en | ✅ |
| Integrační a render testy (testovací agent) | 🔄 |
| Ověření na zařízení | ⏳ (dev build) |

*Hotovo, když:* máš zadané zásoby doma a na chatě a přijde připomínka ⏳.

### M2 – Mapa a místa srazu ⬜
Připraveno: tabulka `meeting_points` (bez souřadnic), místo srazu z onboardingu se ukládá.
Soubor mapy ČR (PMTiles) stáhneme až na SSD.

### M3 – Účty a rodina ⬜
**Změna zadání:** přihlášení e-mailem s kódem + Google + Apple (Apple je povinný, pokud je nabízený Google). Další poskytovatelé upřesníme.
Připraveno: všechny tabulky mají UUID, `updated_at` a `deleted_at` pro synchronizaci.

### M4 – Platby a limity ⬜
Připraveno: ceny, produkty a limity v `app/lib/config.ts`.

### M5 – Srovnání zemí 🔄
| Část | Stav |
|---|---|
| Data CZ, SK, PL, FI (JSON) | ✅ návrh |
| Srovnávací tabulka ke kontrole | ✅ `docs/country-comparison.md` ⏳ schválení |
| Obrazovka srovnání, volba standardu | ⬜ |

### M6 – Poslední známá poloha ⬜
### M7 – Beta a vydání ⬜

### Grafický styl (tvůj požadavek, poslední krok dne) ⬜

## Změny zadání
| Datum | Změna | Dopad |
|---|---|---|
| 2026-09-22 | SSO: Google + Apple (+ další) místo „jen e-mail“ | M3, Apple guideline 4.8 |
| 2026-09-22 | Jazykové verze pro cílové země: sk, pl, fi | UI i data zemí; strojový překlad → kontrola rodilým mluvčím |
| 2026-09-22 | Grafický styl pro celou aplikaci | poslední krok dnešní práce |
| 2026-09-22 | Agenti: `tester` (průběžné testování), `committer` (commity) | `.claude/agents/` |

## Deník
- **2026-09-22**
  - M0: kostra, GitHub, Docker, API přes tunel, Expo aplikace.
  - M1: kompletní kód zásob.
  - M5: data 4 zemí.
  - Agenti tester a committer.
