# Průběh projektu 72h

Aktualizuje Claude po každém kroku. Legenda: ✅ hotovo · 🔄 rozpracováno · ⏳ čeká na tebe · ⬜ nezačato · ❌ zrušeno

**Poslední aktualizace:** 2026-09-23

## Kde jsme (2026-09-23 večer)
- **Vývoj běží na Macu** (`~/projects/72h`): Docker (OrbStack) se serverem na `localhost:8000`, Metro, iOS simulátor (Xcode 27 → Device Hub). RPi je vypnuté, `api.jennase.org` proto neodpovídá.
- **M2:** hotové a v simulátoru ověřené: offline mapa, stažení oblasti, dohledání adresy, místa srazu, navigace se šipkou, dětská obrazovka (zprávu upravuje rodič ve Více). Chybí ověření na skutečném telefonu v režimu letadlo (kompas).
- **Onboarding:** lze přidat víc míst se zásobami (podle tarifu).
- **Návrhy s prioritou** viz „Návrhy do dalších milníků“ níže.

## ⏳ Co čeká na tebe
1. Rozhodnout bundle ID: v buildu je `org.jennase.app72h`, dřív doporučené bylo `org.jennase.family72h` (změna = nový dev build).
2. Otestovat M2 na telefonu (dev build pro zařízení: `npx eas-cli@latest build --profile development --platform ios`, vyžaduje Apple účet).
3. Schválit zdroje v `docs/country-comparison.md` a rozhodnutí R1–R5 v `docs/threat-model.md` (potřebné pro M3, M5, M6).
4. Rozhodnout, kde poběží server pro M3 (RPi + SSD podle plánu, nebo jinak) – teď běží jen lokálně na Macu.

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
| Dočasná ochrana endpointu klíčem `X-Dev-Key` (do M3) | ✅ (klíč je v `.env`) |
| Zdroj mapy: zatím vzdálené sestavení Protomaps, po SSD lokální `maps/cz.pmtiles` | 🔄 |
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
| 3 | Kontakty rodiny | začátek M3 | Největší přínos v nouzi, malá práce, navazuje na dětskou obrazovku. |
| 4 | Složení domácnosti: dospělí / děti / miminka + potřeby miminek | M5 | Mění onboarding a checklist – lepší před vydáním. Malá změna dat. |
| 5 | Role rodič / dítě | M3 (s rodinnou skupinou) | Dává smysl, až bude mít aplikaci víc členů rodiny. |
| 6 | Jídlo podle kalorií a pestrosti | M5 (po bodu 4) | Vylepšení výpočtu, větší změna. Stávající denní dávky zatím stačí. |

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

### Kontakty rodiny → M3
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

### M3 – Účty a rodina ⬜
**Změna zadání:** přihlášení e-mailem s kódem + Google + Apple (Apple je povinný, pokud je nabízený Google). Další poskytovatelé upřesníme.
Připraveno: všechny tabulky mají UUID, `updated_at` a `deleted_at` pro synchronizaci.

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
