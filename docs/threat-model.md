# Model hrozeb a návrh šifrování – rodina a poslední známá poloha (M3 + M6)

Stav: **NÁVRH ke schválení** (zadání vyžaduje schválení před M6). Datum: 2026-09-22.

## 1. Co chráníme
| Aktivum | Citlivost | Kde leží |
|---|---|---|
| Poslední známá poloha člena | vysoká (kde je dítě / domov) | zařízení; server jen ciphertext |
| Místa srazu, lokality zásob (často adresa domova) | vysoká | zařízení; server (viz rozhodnutí R2) |
| Seznam zásob | nízká–střední (co a kde je doma) | zařízení; server (R2) |
| E-mail, členství v rodině | střední (osobní údaj) | server |
| Klíč rodiny | kritická | jen zařízení (Keychain / Keystore) + pozvánka |

## 2. Útočníci a scénáře
| # | Útočník | Scénář | Opatření |
|---|---|---|---|
| T1 | Útočník se přístupem k serveru / záloze DB (únik, ukradený disk z RPi) | čte polohy a data rodin | E2E šifrování klíčem rodiny; server nemá klíč; disk RPi a zálohy šifrované |
| T2 | Provozovatel (my) nebo nařízení k vydání dat | vydání polohy | server má jen poslední ciphertext bez historie; nemáme co vydat v čitelné podobě |
| T3 | Bývalý člen rodiny (rozchod, rozvod) | sleduje dál polohu | odchod/odebrání → server smaže člena a jeho polohu; **rotace klíče rodiny** a nová pozvánka ostatním (R3) |
| T4 | Kontrolující partner / skryté sledování | zapne sdílení na cizím telefonu | sdílení zapíná jen majitel zařízení sám; stálý viditelný indikátor v aplikaci; systémový indikátor polohy; notifikace všem v rodině při zapnutí; nelze zapnout vzdáleně |
| T5 | Zachycená pozvánka (QR vyfocený, odkaz přeposlaný) | cizí se připojí do rodiny | pozvánka jednorázová, platnost 24 h, zakladatel/admin nového člena potvrdí; klíč je ve fragmentu URL (`#`), který se neposílá na server |
| T6 | Útočník na síti | MITM | TLS (Cloudflare), certificate pinning nezavádíme (složitost), obsah je stejně E2E |
| T7 | Ukradený odemčený telefon | vidí polohu rodiny | mimo rozsah (stejné jako jiné aplikace); smazání zařízení z rodiny na dálku adminem |
| T8 | Zneužití API (spam kódů, DoS RPi) | výpadek, náklady na e-maily | rate limit na IP + e-mail, Cloudflare pravidla, limit výřezů map |
| T9 | Dítě pod 15 let | zpracování polohy bez souhlasu | účet dítěte zakládá rodič (souhlas), dítě vidí indikátor a o sdílení ví; žádné skryté režimy |

## 3. Návrh šifrování
- Knihovna: **libsodium** (`react-native-libsodium`), jen vysokoúrovňové API.
- **Klíč rodiny** `K_family`: 32 B náhodný (`crypto_secretbox_keygen`), vytvoří ho zakladatel na zařízení.
- Uložení: `expo-secure-store` (iOS Keychain / Android Keystore), nikdy v SQLite ani v záloze na server.
- **Pozvánka:** `https://72h.app/join#<familyId>.<inviteToken>.<base64url(K_family)>` (QR obsahuje totéž).
  - `inviteToken` = jednorázový token pro server (připojení ke skupině), serveru se posílá jen ten.
  - Klíč je ve fragmentu → prohlížeč ani server ho nedostanou.
- **Šifrování dat:** `crypto_secretbox_easy(plaintext, nonce24, K_family)`, nonce náhodný pro každou zprávu, uložen s ciphertextem.
  - Poloha: plaintext JSON `{lat, lon, accuracy, ts}` zaokrouhlený na ~10 m.
  - Server ukládá `(member_id, nonce, ciphertext, updated_at)` – **jediný řádek na člena**, UPSERT, žádná historie.
- **Verze klíče:** `key_version` u každého ciphertextu; při rotaci (T3) nová verze, staré záznamy se přepíšou při další aktualizaci, zbytek se smaže.
- **Rotace klíče:** admin vygeneruje nový klíč → sdílí ho zbylým členům přes **sealed box** na jejich veřejné klíče (`crypto_box_seal`). Každé zařízení má pár klíčů `crypto_box_keypair`, veřejný klíč je na serveru. (Alternativa jednodušší: nová pozvánka všem – horší UX.)

## 4. Rozhodnutí ke schválení
- **R1:** Šifrovat end-to-end jen polohu (povinně), nebo i ostatní synchronizovaná data?
- **R2 (doporučuji):** E2E šifrovat **všechno synchronizované** (lokality, zásoby, místa srazu, poloha). Server pak drží jen neprůhledné záznamy `(family_id, record_id, type, updated_at, deleted, nonce, ciphertext)` a „poslední změna vyhrává“ řeší podle `updated_at`.
  - Výhoda: jednodušší GDPR, menší dopad úniku, stejný kód pro vše.
  - Nevýhoda: server nemůže validovat obsah; limity (počet položek) počítá podle počtu záznamů daného typu, což stačí.
- **R3:** Rotace klíče přes sealed box (doporučuji) vs. nová pozvánka všem.
- **R4:** SSO (Google/Apple) jen identifikuje účet – s klíčem rodiny nesouvisí. Přihlášení na novém zařízení neobnoví klíč; klíč se přenese pozvánkou nebo QR z jiného zařízení rodiny. **Ztráta všech zařízení = ztráta dat na serveru** (lze znovu naskenovat pozvánku od člena rodiny).
- **R5:** Záloha klíče (např. vytisknout QR „obnovovací kód“)? Doporučuji ano, volitelně, s vysvětlením.

## 5. Poloha na pozadí – provozní pravidla (M6)
- Výchozí stav vypnuto; zapíná jen uživatel sám jedním přepínačem; při běhu je vidět stav „Sdílíš poslední polohu s rodinou“.
- iOS: `significant location change` + omezení na ~1×/h; Android: `expo-location` background s `distanceInterval: 1000` a `timeInterval: 3600000`, foreground service notifikace (Android to vyžaduje – slouží i jako indikátor).
- Jen „Při používání“ → aktualizace jen při otevření aplikace + vysvětlení.
- Server: žádné logy souřadnic (je to ciphertext), logy bez osobních údajů (jen member_id hash).
