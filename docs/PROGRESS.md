# Průběh projektu 72h

Aktualizuje Claude po každém kroku. Legenda: ✅ hotovo · 🔄 rozpracováno · ⏳ čeká na tebe · ⬜ nezačato · ❌ zrušeno

**Poslední aktualizace:** 2026-09-24

## Kde jsme (2026-09-23 večer)
- **Vývoj běží na Macu** (`~/projects/72h`): Docker (OrbStack) se serverem na `localhost:8000`, Metro, iOS simulátor (Xcode 27 → Device Hub). RPi je vypnuté, `api.jennase.org` proto neodpovídá.
- **M2:** hotové a v simulátoru ověřené: offline mapa, stažení oblasti, dohledání adresy, místa srazu, navigace se šipkou, dětská obrazovka (zprávu upravuje rodič ve Více). Chybí ověření na skutečném telefonu v režimu letadlo (kompas).
- **Onboarding:** lze přidat víc míst se zásobami (podle tarifu).
- **Návrhy s prioritou** viz „Návrhy do dalších milníků“ níže.

## ⏳ Co čeká na tebe
0. **Projít dnešní večerní práci** (krizové zavazadlo, jídlo doma, kontakty v záložce Rodina) a **schválit plán M3** níže.
1. ✅ Bundle ID: `com.rodinnapripravenost.app` (rozhodnuto 2026-09-25; aplikace dostane vlastní doménu `rodinnapripravenost.com` – Cloudflare .cz neprodává; nic na `jennase.org`).
2. Otestovat M2 na telefonu (dev build pro zařízení: `npx eas-cli@latest build --profile development --platform ios`, vyžaduje Apple účet).
3. Schválit zdroje v `docs/country-comparison.md` a rozhodnutí R1–R5 v `docs/threat-model.md` (potřebné pro M3, M5, M6).
4. ~~Rozhodnout, kde poběží server~~ → **malý VPS v EU** (rozhodnuto 2026-09-24). Návrh viz „Server (VPS)“ níže – založit účet a server.

## Jak spustit vývoj na Macu
```bash
cd ~/projects/72h && docker compose up -d          # server
cd app && npx expo start --dev-client               # Metro (NE s CI=1 – pak nesleduje změny)
```
Simulátor: Xcode → Open Developer Tool → Device Hub → iPhone 18 Pro. Aplikace 72h se připojí na `localhost:8081`.

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

### M2 – Mapa a místa srazu 🔄
| Část | Stav |
|---|---|
| Server: výřez oblasti z mapy (`POST /v1/maps/extracts`) | ✅ ověřeno naživo přes `api.jennase.org` (9,5 km² Prahy = 5,1 MB, 34 s) |
| Server: kontrola, že je oblast v ČR, a limit plochy (zdarma 500 km²) | ✅ + testy |
| Server: stažení s podporou pokračování (HTTP Range) | ✅ + testy |
| Server: počítání stažení za měsíc | ⬜ potřebuje přihlášení (M3) |
| Dočasná ochrana endpointu klíčem `X-Dev-Key` (do M3) | ✅ → v M3 nahrazeno limitem na zařízení/účet |
| Zdroj mapy: zatím vzdálené sestavení Protomaps, na VPS lokální `maps/cz.pmtiles` | 🔄 |
| Písma a ikony mapy pro offline (`scripts/fetch-map-assets.sh` → `maps/assets`, mimo git) | ✅ skript |
| Server: písma a ikony pro aplikaci (`/v1/maps/assets`) | ✅ + testy |
| Aplikace: výběr oblasti (moje poloha / hledání adresy, velikost podle tarifu), stažení s průběhem a zrušením, počítadlo stažení | ✅ kód + testy |
| Aplikace: offline mapa (MapLibre + PMTiles, písma a ikony z telefonu), GPS, místa srazu na mapě | ✅ kód + testy |
| Aplikace: úprava místa srazu (GPS nebo klepnutí do mapy), limit Free = 1 místo | ✅ kód + testy |
| Aplikace: šipka + vzdálenost (kompas), dětská obrazovka s tlačítkem 112 | ✅ kód + testy |
| Ověření na telefonu v režimu letadlo (potřebuje nový dev build – MapLibre je nativní modul) | ⏳ |
Připraveno: tabulka `meeting_points`, místo srazu z onboardingu se ukládá.

## Návrhy do dalších milníků (nejsou kritické)

**Zásada (2026-09-23):** aplikace musí zůstat jednoduchá. Nové věci přidávat jako **volitelnou možnost s návodem uvnitř** (vzor: „Přidat krizové zavazadlo“), ne jako další odkazy na hlavních obrazovkách.

| Priorita | Návrh | Milník | Proč |
|---|---|---|---|
| ✅ | Doporučené jídlo doma (konkrétní seznam) | hotovo 2026-09-23 | Checklist → Trvanlivé jídlo → „Co konkrétně?“ |
| ✅ | Krizové (evakuační) zavazadlo | hotovo 2026-09-23 | Lokality → „Přidat krizové zavazadlo“ → „Co zabalit“ |
| ✅ | Kontakty rodiny (v telefonu) | hotovo 2026-09-23 | Záložka Rodina; sdílení v rodině přijde s M3. |
| 4 | Složení domácnosti: dospělí / děti / miminka + potřeby miminek | M5 | Mění onboarding a checklist – lepší před vydáním. Malá změna dat. |
| 5 | Role rodič / dítě | M3 (s rodinnou skupinou) | Dává smysl, až bude mít aplikaci víc členů rodiny. |
| 6 | Jídlo podle kalorií a pestrosti | M5 (po bodu 4) | Vylepšení výpočtu, větší změna. Stávající denní dávky zatím stačí. |
| ⏳ | Web aplikace (proč ji stavíme, jak funguje, návod, plán, ochrana soukromí) + komunitní nástěnka nápadů; v aplikaci jen řádek ve Více. **Rozhodnuto 2026-09-24:** web poběží jinde než náš server (kde – určí uživatel); na nápady odpovídá Claude nebo jiná AI | návrh 2026-09-24 | Komunita, důvěra; web a zásady soukromí stejně potřebuje M7. AI odpovědi označit jako odpověď AI; sliby o funkcích schvaluje člověk. |
| ✅ | Domácnost: dospělí + děti (dítě = celá osoba podle 72h.gov.cz), věci pro děti (hračky, kartička do kapsy) jen v dětském / společném zavazadle; miminka až s ověřeným zdrojem | hotovo 2026-09-24 | Onboarding + Více. |
| ✅ | Karta „Krizové zavazadlo“ na záložce Zásoby (sbaleno X z Y, expirace v zavazadle). **Rozhodnuto:** výchozí jedno zavazadlo na osobu (jména), volitelně jedno pro celou domácnost (množství × osoby); vlastní odškrtávání pro každé; dětské + hračka a kartička | hotovo 2026-09-24, karta vždy viditelná | Přání uživatele; výjimka z pravidla „nic navíc na hlavních obrazovkách“. |

### Doporučené jídlo doma ✅
Nápad (2026-09-23): chybí doporučení, **co za jídlo** mít doma.

| Část | Jak |
|---|---|
| Data | Položku „Trvanlivé jídlo“ rozdělit na konkrétní druhy podle 72h.gov.cz/cs/jidlo: masové a rybí konzervy, luštěniny, rýže/těstoviny, trvanlivé pečivo, ořechy a sušené ovoce, trvanlivé mléko, med/cukr, sůl, olej, čokoláda/tyčinky, jídlo, které nepotřebuje vaření. U každého orientační množství na osobu a den a poznámka (např. „vyberte, co jíte i normálně“). |
| Aplikace | Stávající checklist (Zásoby → Co mít doma) – nová skupina „Jídlo“ s těmito položkami. Kód skoro beze změny. |
| Ostatní země | SK/PL/FI doplnit ze stejných oficiálních zdrojů, ke schválení v `docs/country-comparison.md`. |

### Krizové zavazadlo ✅
Nápad (2026-09-23, Zuzka): evakuační zavazadlo pro rychlý odchod z domu.

| Část | Jak |
|---|---|
| Data | Nový seznam podle 72h.gov.cz/cs/evakuace: doklady, léky, hotovost, voda a jídlo na 2–3 dny, oblečení, spacák/deka, lékárnička, svítilna, powerbanka, hygiena, kontakty na papíře… Množství **na osobu**, dětská varianta menší. |
| Aplikace | Více → **Krizové zavazadlo** (odkaz i ze Zásob): checklist se zaškrtáváním, stejný jako „Co mít doma“. |
| Volitelně | Zavazadlo jako vlastní místo zásob („Batoh“), aby se hlídala i expirace jídla a léků v něm – využije existující místa a připomínky. |


### Složení domácnosti a potřeby miminek → M5
Nápad (2026-09-23): v onboardingu a ve Více zvolit počet **dospělých, dětí a miminek** (místo jen „osob“).

| Část | Jak |
|---|---|
| Domácnost | Tři počitadla: dospělí, děti (3–14 let), miminka (0–2 roky) + zvířata. Stávající „osoby“ = dospělí. |
| Jak přidat | Vzorem „Přidat krizové zavazadlo“: volba „Přidat potřeby pro miminko“ / „pro dítě“, návod uvnitř. |
| Checklist | Položky v datech zemí dostanou základ `baby` / `child` vedle `person`. Položky pro miminka (pleny, vlhčené ubrousky, kojenecké mléko nebo příkrmy, láhev, teploměr, léky pro děti) se ukážou **jen když je miminko > 0**. |
| Voda a jídlo | Děti a miminka počítat vlastní potřebou (zdroj doplnit při schvalování dat M5). Kojenecké mléko = voda navíc na přípravu. |
| Zdroje | Doplnit do `docs/country-comparison.md` ke schválení. |

### Kontakty rodiny ✅ (v telefonu; sdílení → M3)
Nápad (2026-09-23): aplikace má obsahovat adresy a telefonní čísla rodiny, aby je v nouzi viděly i děti.

**Návrh (co nejjednodušší):**
| Část | Jak |
|---|---|
| Data | Nová tabulka `contacts` v telefonu: jméno, vztah (máma, babička…), telefon, adresa, poloha (dohledá se z adresy stejně jako u míst srazu), poznámka. Funguje offline. |
| Obrazovka | Více → **Kontakty**: seznam, přidat, upravit, smazat. Zadání ručně, bez přístupu ke kontaktům v telefonu (méně oprávnění, jednodušší). |
| Děti | Dětská obrazovka ukáže kontakty velkým písmem s tlačítky **Zavolat** a **Jak se tam dostat** (stejná šipka jako u míst srazu). |
| Tísňová čísla | 112 + národní čísla (CZ 150/155/158) z dat zemí, vždy nahoře. |
| Tarif | Zdarma (bezpečnostní funkce jako dětská obrazovka), bez limitu. |
| Rodina (M3) | Kontakty se sdílí v rodinné skupině, šifrované rodinným klíčem jako ostatní osobní data. Do M3 jen v telefonu. |

**Co zatím ne:** import z kontaktů telefonu, tisk kartičky (PDF export je mimo 1.0), zobrazení na zamčené obrazovce.
**Odhad:** malý krok (1 tabulka, 2 obrazovky, úprava dětské obrazovky, testy).
**Otázky:** Mají se kontakty ukazovat i na hlavní obrazovce Mapa, nebo stačí Více + dětská obrazovka? Stačí tísňová čísla CZ, nebo podle zvoleného standardu země?

### Jídlo podle kalorií a pestrosti → M5
Nápad (2026-09-23): nepočítat jen „denní dávky“, ale i kalorie a pestrost, aby zásoby nebyly jen rýže.

| Část | Jak (co nejjednodušeji) |
|---|---|
| Domácnost | Místo „počet osob“: dospělí + děti (věk 1–3 / 4–8 / 9–13 / 14+). |
| Potřeba na den | Dospělý 2 000 kcal, děti podle věku ~1 000 / 1 400 / 1 800 kcal (orientační hodnoty EFSA, v krizi stačí). Zdroj uvést v aplikaci. |
| Položky jídla | Výběr druhu z krátkého seznamu (rýže, těstoviny, luštěniny, masová konzerva, rybí konzerva, zeleninová konzerva, ořechy, olej, trvanlivé pečivo, sušené ovoce, tyčinky…) + množství v kg/ks. Kalorie a bílkoviny se dopočítají z tabulky (`data/foods.json`, zdroj NutriDatabáze). Vlastní položka = ruční kcal, nebo dál „denní dávky“. |
| Dny zásob | Jídlo = kalorie celkem ÷ potřeba domácnosti za den. |
| Pestrost | Místo přesných maker jednoduchá kontrola skupin: sacharidy · bílkoviny · tuky · ovoce/zelenina. Chybějící skupina = konkrétní tip („Přidejte luštěniny nebo konzervy – máte málo bílkovin“). |

**Proč ne přesná makra:** vyžadují zadávat nutriční hodnoty ke každé položce, to lidi nebudou dělat. Skupiny + kalorie řeší „jen rýže“ a zůstávají jednoduché.
**Dopad:** migrace položek, výpočet připravenosti, onboarding, checklist. Střední krok, spolu se standardy zemí v M5.

### Role v rodině (rodič / dítě) → M3
Nápad (2026-09-23): odlišit, kdo aplikaci používá.

| Část | Jak |
|---|---|
| Kde | V M3 (rodinná skupina): rodič zve člena a volí roli rodič/dítě. |
| Dítě vidí | Dětskou obrazovku jako úvod, místa srazu se šipkou, kontakty rodiny, tísňová čísla, zásoby jen ke čtení. |
| Dítě nemění | Zásoby, místa srazu, kontakty, zprávu pro děti, nastavení. Nechtěné změny by se sdílely celé rodině. |
| Rodič | Vše jako dnes. |
| Do M3 | Nic – jeden telefon = jedna osoba, zbytečná složitost. |

### M3 – Účty a rodina 🔄 – plán schválen 2026-09-24
**Změna zadání:** přihlášení e-mailem s kódem + Google + Apple (Apple je povinný, pokud je nabízený Google). Další poskytovatelé upřesníme.
Připraveno: všechny tabulky (i `contacts`) mají UUID, `updated_at` a `deleted_at` pro synchronizaci.

**Zásada jednoduchosti:** aplikace dál funguje celá **bez účtu** a offline. Účet je potřeba jen pro sdílení s rodinou. Na hlavních obrazovkách nepřibude nic – vše je v záložce Rodina („Sdílet s rodinou“).

| Krok | Co | Poznámka |
|---|---|---|
| 1 | Server: účty a přihlášení e-mailem s kódem (6 číslic, 10 min, limit pokusů), relace (token v Secure Store) | ✅ server + testy (2026-09-24); e-mail zatím jen do logu (`EMAIL_PROVIDER=log`), aplikace ⬜; `X-Dev-Key` u map nahradí krok 7 |
| 2 | Server: ověření Google a Apple tokenů (JWKS), propojení s účtem podle e-mailu | potřebuje OAuth klienty od tebe |
| 3 | Aplikace: Rodina → „Sdílet s rodinou“ → přihlášení (e-mail / Google / Apple) | ✅ e-mail + kód, účet, export, smazání (2026-09-24); Google/Apple s krokem 2 |
| 4 | Rodinná skupina + pozvánka QR/odkaz s klíčem ve fragmentu (podle modelu hrozeb) | ✅ server + aplikace + testy: 1 rodina na účet, pozvánka jednorázová 24 h (QR + odkaz), admin schvaluje nové členy, limit členů, stránka `/join` předá odkaz aplikaci |
| 5 | Synchronizace: šifrované záznamy (R1+R2), push/pull, poslední změna vyhrává; lokality, zásoby, místa srazu, kontakty | ✅ server + aplikace + testy: kontakty, zásoby, místa zásob, místa srazu; při spuštění, návratu do aplikace a tlačítkem; fotky míst srazu a checklist zůstávají v telefonu |
| 6 | Smazání účtu a export dat (JSON) v aplikaci | ✅ server + aplikace + testy (`GET /v1/me/export`, `DELETE /v1/me`, předání role správce) |
| 7 | Limity stahování map: bez účtu na zařízení (anonymní ID zařízení), s účtem na účet | ✅ server + aplikace + testy (2026-09-24): `X-Dev-Key` zrušen, stejná oblast znovu v měsíci se nepočítá, strop 200 nových stažení/h pro celý server |
| 8 | První Android build do uzavřeného testu Google Play | potřebuje vývojářský účet Google Play (25 USD) |
| – | Role rodič / dítě (návrh, priorita 5) | až po kroku 4, jen pokud potvrdíš |

**Co potřebuju od tebe před začátkem:**
1. ✅ **Kde poběží server:** malý VPS v EU (rozhodnuto 2026-09-24). Potřebuju: účet u poskytovatele (např. Hetzner), server s Ubuntu LTS v EU, můj přístup přes SSH klíč. `api.jennase.org` pak přesměruju na VPS.
2. ✅ **R1–R5** rozhodnuto 2026-09-24 (na přání uživatele vybral Claude podle jednoduchosti): šifrovat vše synchronizované; v 1.0 bez sealed boxu a bez obnovovacího QR – viz `docs/threat-model.md`.
3. **E-mailová služba** pro kódy: Brevo nebo Resend – založit účet a dát API klíč do `.env`.
4. **Apple Developer** (99 USD/rok – nutné i pro testování na iPhonu) a **Google Cloud OAuth** klient.
5. ✅ Stahování map **i bez účtu** (rozhodnuto 2026-09-24) – limit Free se počítá na zařízení, s účtem na účet.

### Server (VPS) – **rozhodnuto 2026-09-24: Hetzner CX23 + zálohy Hetzneru (varianta C)** ⏳ založit
Požadavek: levný, ale spolehlivý. Aplikace funguje offline, server je jen pro synchronizaci a stažení map – krátký výpadek nic nerozbije. Všechny ceny s 21% DPH (CZ spotřebitel), ověřeno na stránkách poskytovatelů 2026-09-24.

| Varianta | Parametry | Cena/měsíc s DPH | Plusy | Minusy |
|---|---|---|---|---|
| A: netcup VPS nano G11.5s | 2 vCPU, 2 GB RAM, 60 GB SSD, přenos v ceně, IPv4+IPv6, Norimberk | **≈ 3,75 € (~95 Kč)** | nejlevnější ze spolehlivých německých | závazek 6 měsíců; přechod na větší tarif = přesun serveru (~1 h); zálohy si děláme sami |
| B: Hetzner CX23, zálohy sami | 2 vCPU, 4 GB, 40 GB, 20 TB přenosu | ≈ 7,25 € (~180 Kč) | platba po hodinách, zvětšení během minut, nejlepší správa | 2× dražší |
| **C: Hetzner CX23 + zálohy Hetzneru (vybráno)** | totéž + 7 denních záloh celého serveru | ≈ 8,60 € (~215 Kč) | nejpohodlnější | nejdražší |
| Forpsi (CZ) | 2 vCPU, 4 GB, 40 GB NVMe, 25 TB | 193,60 Kč | česká firma | cena jako B, menší 1GB tarif dočasně nedostupný |
| AWS / Azure / Google Cloud | – | obvykle násobně víc | – | platí se hlavně přenos dat (desítky USD za každý TB stažených map), složité účtování |

Zálohy: denní zálohy celého serveru u Hetzneru (7 dní) + noční `pg_dump` na serveru (je pak i v záloze). Kopie mimo Hetzner (Cloudflare R2) až bude víc uživatelů. Databáze je malá a obsahuje jen šifrované záznamy rodin.
Velikost: API + Postgres dnes ~50 MB RAM → 2 GB stačí. Mapa ČR odhadem 1–3 GB.
Přístup: `api.jennase.org` přes Cloudflare Tunnel (na serveru otevřené jen SSH), SSH klíč `~/.ssh/id_ed25519_72h_vps` na Macu.

### M4 – Platby a limity ⬜
Připraveno: ceny, produkty a limity na jednom místě v `config/tiers.json` (čte aplikace i server).

### M5 – Srovnání zemí 🔄
| Část | Stav |
|---|---|
| Data CZ, SK, PL, FI (JSON) | ✅ návrh |
| Srovnávací tabulka ke kontrole | ✅ `docs/country-comparison.md` ⏳ schválení |
| Obrazovka srovnání, volba standardu (moje země / nejpřísnější) | ✅ kód + testy |
| Checklist, cílový počet dní a voda na den se řídí zvoleným standardem | ✅ |

### M6 – Poslední známá poloha ⬜
Připraveno: **model hrozeb a návrh šifrování** `docs/threat-model.md` ⏳ čeká na schválení (rozhodnutí R1–R5).
### M7 – Beta a vydání ⬜
Koncepty: `docs/privacy-policy.md` (doplnit správce), `docs/store-texts.md` (cs + en).

### Grafický styl (tvůj požadavek, poslední krok dne) ⬜

## Změny zadání
| Datum | Změna | Dopad |
|---|---|---|
| 2026-09-22 | SSO: Google + Apple (+ další) místo „jen e-mail“ | M3, Apple guideline 4.8 |
| 2026-09-22 | Jazykové verze pro cílové země: sk, pl, fi | UI i data zemí; strojový překlad → kontrola rodilým mluvčím |
| 2026-09-22 | Grafický styl pro celou aplikaci | poslední krok dnešní práce |
| 2026-09-22 | Agenti: `tester` (průběžné testování), `committer` (commity) | `.claude/agents/` |
| 2026-09-23 | Kontakty rodiny (adresy, telefony) viditelné i pro děti | návrh → M3 |
| 2026-09-23 | Zpráva pro děti upravitelná rodičem (Více) | ✅ hotovo |
| 2026-09-23 | Jídlo podle kalorií a pestrosti, domácnost dospělí + děti | návrh → M5 |
| 2026-09-23 | Role rodič / dítě | návrh → M3 |
| 2026-09-23 | Domácnost dospělí / děti / miminka, potřeby miminek (pleny…) jen když je miminko | návrh → M5 |
| 2026-09-23 | Doporučené jídlo doma + krizové zavazadlo (Zuzka) | návrh → M5, priorita 1 a 2 |
| 2026-09-25 | Vlastní doména aplikace `rodinnapripravenost.com` (ne `jennase.org` – tam běží soukromé věci; .cz Cloudflare neprodává); Bundle ID `com.rodinnapripravenost.app`, API `api.rodinnapripravenost.com` | nový dev build; tunel a e-mail na nové doméně |
| 2026-09-24 | Šifrování přes `@noble/ciphers` (čistý JS) místo nativní libsodium; QR pozvánku čte systémový fotoaparát | méně nativních modulů, jednodušší build |
| 2026-09-24 | Server na malém VPS v EU místo RPi + SSD | M3 začne založením VPS; RPi omezení (RAM, SD karta) odpadají |
| 2026-09-24 | Název „72h – Rodinná připravenost“ jen pro český obchod; SK/PL/FI/EN vlastní názvy (nerozhodnuto) | M7 texty obchodů; FI: „72 tuntia“ je národní doporučení → název bez „72h“ |

## Deník
- **2026-09-22**
  - M0: kostra, GitHub, Docker, API přes tunel, Expo aplikace.
  - M1: kompletní kód zásob.
  - M5: data 4 zemí.
  - Agenti tester a committer.
  - Jazyky sk, pl, fi (rozhraní i data zemí).
  - M2 server: výřez mapy, limity, testy, dočasný klíč.
  - M5: obrazovka srovnání a volba standardu.
  - Dokumenty: model hrozeb, zásady ochrany soukromí, texty pro obchody (koncepty).
- **2026-09-23**
  - Commit skriptu `scripts/fetch-map-assets.sh` (písma a ikony mapy pro offline).
  - Rozpracované M2 (stahování mapy v aplikaci) commitnuto jako WIP. Vývoj se přesouvá z RPi na Mac; server na RPi zastaven.
  - Vývoj přesunut na Mac (`~/projects/72h`): Docker (OrbStack), Node, server běží lokálně (`localhost:8000`).
  - M2 aplikace: záložka Mapa, oblasti mapy, místa srazu, navigace se šipkou, dětská obrazovka. Texty v 5 jazycích (sk/pl/fi strojově).
  - Opravy mapy (písma, střed mapy, Metro v CI režimu nesledoval změny), dohledání adres, víc míst v onboardingu, „Offline mapy“ místo „Oblasti mapy“.
  - Návrhy s prioritou: kontakty rodiny (M3), domácnost dospělí/děti/miminka (M5), role rodič/dítě (M3), kalorie a pestrost jídla (M5).
  - Jídlo doma (konkrétní seznam) a krizové zavazadlo podle 72h.gov.cz (`data/guides.json`, sk/pl/fi strojově). Zavazadlo = volitelné místo zásob s návodem. **M4:** zavazadlo nepočítat do limitu míst zásob ve Free.
  - Kontakty rodiny: záložka Rodina (jméno, kdo to je, telefon, adresa s dohledáním), volání, navigace k adrese, na dětské obrazovce „Komu zavolat“. Tabulka `contacts` má sloupce pro synchronizaci v M3.
  - Tísňová čísla a linky pomoci v záložce Rodina (CZ podle 72h.gov.cz/cs/dulezite-kontakty; PL podle gov.pl, FI podle 112.fi (jediné číslo 112); SK zatím jen 112 – oficiální stránku minv.sk jsem nenašel), rada „co říct na 112“ na dětské obrazovce, „Jak s dětmi mluvit v krizi“ (72h.gov.cz/cs/deti) ve Více u zprávy pro děti.
  - Potřeby miminek: 72h.gov.cz je neuvádí → čeká na spolehlivý zdroj (návrh priorita 4).
  - Průvodci u položek checklistu (oficiální 72h.gov.cz): Voda → „Co když neteče voda?“, Lékárnička → „Zásady první pomoci“ (postup + lékárnička k odškrtání), Svítilna → „Co dělat bez proudu?“. V PL/FI verzi první pomoci jsou čísla 999/112 místo 155. Název obrazovky „Checklist“ → „Co mít doma“.
  - Rádio → „Kde hledat zprávy?“ (oficiální zdroje, jak poznat fámu; 72h.gov.cz/cs/informace-komunikace). Test, že všechny jazyky mají stejné klíče. Tmavý režim nových obrazovek zkontrolován; modré odkazy mají v tmavém režimu nižší kontrast → řešit v grafickém stylu.
- **2026-09-24**
  - Tísňová čísla SK: 112, 150, 155, 158 podle slovensko.sk (Ústredný portál verejnej správy). Země bez ověřeného zdroje dál ukazují jen 112.
  - Více → O aplikaci (jen česky): odkaz na oficiální příručku 72h.gov.cz a věta, že aplikace není spojená s MV ani s projektem 72 hodin. Právní otázky k převzatému obsahu a názvu → `Co potřebuju od tebe` (artefakt).
  - Dotaz na MV (posta@mv.gov.cz) k užití obsahu 72h.gov.cz a k názvu odeslán z Gmailu. Název „72h – Rodinná připravenost“ jen pro CZ.
  - Ochranné známky (TMview, úřady CZ/EM/WO, stav Registered/Filed, třídy 9/41/42): „72 hodin“ nic; „72h“ 28 výsledků, žádná známka „72h“/„72 hodin“ ve třídě 9 nebo 42, nic od MV. Nejbližší: „72horas M2M TECHNOLOGIES“ (EM 013580361; 9/38/42; jiné slovo a obor) a „FIRST 72HR“ (EM 019206352; 35/41) → nízké riziko. TMview není oficiální rejstřík, obrazové známky bez textu nezachytí. Zbývá riziko podobnosti se státním projektem → čeká na odpověď MV.
  - Rozhodnuto: produkční server poběží na malém VPS v EU (ne RPi + SSD).
  - Návrh VPS: Hetzner CX23 (5,49 € bez DPH, ceny od 15. 6. 2026), zálohy, IPv4 ≈ 8,60 €/měsíc s DPH. SSH klíč pro server vytvořen na Macu.
  - Levnější servery: netcup VPS nano ≈ 3,75 €/měsíc s DPH (doporučení), Hetzner CX23 ≈ 7,25–8,60 €, AWS a spol. dražší kvůli poplatkům za přenos. Šifrování R1–R5 rozhodnuto (jednoduchá varianta).
  - Server: vybrán Hetzner CX23 se zálohami Hetzneru (≈ 8,60 €/měsíc s DPH).
  - Mapy lze stahovat i bez účtu (limit na zařízení).
  - M3 krok 1 (server): Postgres s migracemi, tabulky users/sessions/login_codes, `POST /v1/auth/email/start|verify`, `GET /v1/me`, `POST /v1/auth/logout`. Kód 6 číslic, 10 min, max 5 pokusů, max 5 kódů/h na e-mail + celkový strop, uložený jen jako HMAC. E-mail přes Brevo nebo Resend podle `.env`. 22 testů serveru OK.
  - Pozn. pro nasazení: Dockerfile stahuje `pmtiles` pro arm64 (RPi) – na Hetzner CX23 (x86) upravit.
  - M3 kroky 4–6 (server): rodina, pozvánky se schválením, šifrovaná synchronizace (poslední změna vyhrává), export a smazání účtu, stránka `/join`. 34 testů serveru OK. Aplikace čeká na instalaci `expo-secure-store`, `react-native-svg`, `react-native-qrcode-svg`, `@noble/ciphers` a nový dev build.
  - M3 krok 7: mapy bez vývojářského klíče – aplikace posílá anonymní ID zařízení, server hlídá měsíční limit na zařízení nebo účet a celkový strop za hodinu. Ověřeno v simulátoru (manifest map 200). 37 testů serveru, 91 testů aplikace.
  - M3 aplikace: přihlášení kódem, rodina, pozvánka s QR (klíč jen ve fragmentu odkazu), schvalování, šifrovaná synchronizace (`@noble/ciphers`), export a smazání účtu. Nový dev build pro simulátor; odkaz z pozvánky v simulátoru otevře aplikaci a uloží pozvánku. Testovací kontakt od „mámy“ uložen na serveru jen šifrovaně. 107 testů aplikace, 37 serveru.
  - **M3 ověřeno v simulátoru (2026-09-24):** pozvánka přes odkaz → přihlášení kódem → připojení → schválení správcem → synchronizace: kontakt, který „máma“ poslala zašifrovaný z jiného zařízení, se objevil v záložce Rodina. „Hotovo, když“ M3 splněno v simulátoru; zbývá Google/Apple přihlášení (krok 2), nasazení na Hetzner, e-mailová služba a Android build (krok 8).
  - Oprava: mapa po přeinstalaci hlásila chybu, protože v databázi byla uložená plná cesta k souboru a iOS při každé instalaci/aktualizaci přesune složku aplikace. Cesta se teď skládá za běhu z ID oblasti. Ověřeno v simulátoru po přeinstalaci, regresní test.
  - Návrhy k revizi (artefakt „Úkoly pro 72h“, sekce Návrhy): web aplikace + nástěnka nápadů, domácnost dospělí/děti, karta krizového zavazadla na Zásobách.
  - Hotovo: domácnost dospělí + děti (onboarding, Více), krizová zavazadla – výchozí jedno na osobu, volitelně jedno společné, karta na Zásobách (sbaleno X z Y, co brzy vyprší), vlastní odškrtávání pro každé zavazadlo, dětská skupina (kartička do kapsy, hračky). Staré jediné zavazadlo se převede automaticky. Pozn.: seznam zavazadel je v telefonu (nastavení), místa zavazadel se synchronizují jako běžná místa zásob. 112 testů aplikace; ověřeno v simulátoru.
- **2026-09-25**
  - Stav účtů (od uživatele): Hetzner účet založený (čeká), Google Play čeká na ověření dokladu, Apple Developer čeká na ověření. Cloudflare: nový tunel `72h-hetzner` s route `api-new.jennase.org → http://localhost:8000` (zatím bez konektoru); `api.jennase.org` dál na tunelu RPi.
  - Dockerfile: `pmtiles` pro arm64 i amd64 (Hetzner CX23 je x86), ověřeno sestavením obou.
  - Hetzner: `hcloud` kontext `72h` nastaven (token zadal uživatel). V Hetzneru vytvořeny SSH klíče `72h-vps-deploy` + `jan-mac` a firewall `72h-ssh` (jen TCP 22 z IP uživatele). Server nešlo založit: nový účet nemá povolené Cost-Optimized typy (CX23/CAX11) → „unsupported location for server type“. Žádost na support@hetzner.com odeslána z Gmailu uživatele. Plán: CAX11 v Helsinkách (ARM, 7,25 €/měs. s DPH) + zálohy, jakmile podpora povolí.
  - E-maily (kontrola Gmailu): **Apple Developer aktivní** (App Store Connect přístup 25. 9.), **Google Play identita ověřena** (25. 9.), Hetzner účet ověřen, na žádost o levné servery zatím jen automatická odpověď (tiket 2026092503023878); MV potvrdilo příjem dotazu, věcná odpověď zatím ne.
  - Rozhodnuto: vlastní doména `rodinnapripravenost.com` (Cloudflare Registrar, .cz tam nejde), Bundle ID `com.rodinnapripravenost.app`, API `https://api.rodinnapripravenost.com`.
  - Doména `rodinnapripravenost.com` koupena v Cloudflare (NS mike/rihana.ns.cloudflare.com). Zbývá route tunelu `api.rodinnapripravenost.com` a smazání `api-new.jennase.org`.
  - Cloudflare hotovo: route tunelu `72h-hetzner` `api.rodinnapripravenost.com → http://localhost:8000` (DNS ověřeno), `api-new.jennase.org` smazána, Always Use HTTPS, Email Routing zapnutý (MX, SPF, DKIM); čeká na potvrzení cílové adresy v Gmailu a pravidlo `info@rodinnapripravenost.com`. Doména se prodlužuje automaticky (další 25. 9. 2027).
