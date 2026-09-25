# Model hrozeb a návrh šifrování – rodina a poslední známá poloha (M3 + M6)

Stav: **rozhodnuto 2026-09-24** (uživatel nechal R1–R5 na Claude s ohledem na jednoduchost aplikace). Návrh: 2026-09-22.

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
| T1 | Útočník s přístupem k serveru / záloze DB (únik, kompromitovaný VPS) | čte polohy a data rodin | E2E šifrování klíčem rodiny; server nemá klíč; zálohy DB šifrované |
| T2 | Provozovatel (my) nebo nařízení k vydání dat | vydání polohy | server má jen poslední ciphertext bez historie; nemáme co vydat v čitelné podobě |
| T3 | Bývalý člen rodiny (rozchod, rozvod) | sleduje dál polohu | odchod/odebrání → server smaže člena a jeho polohu; **rotace klíče rodiny** a nová pozvánka ostatním (R3) |
| T4 | Kontrolující partner / skryté sledování | zapne sdílení na cizím telefonu | sdílení zapíná jen majitel zařízení sám; stálý viditelný indikátor v aplikaci; systémový indikátor polohy; notifikace všem v rodině při zapnutí; nelze zapnout vzdáleně |
| T5 | Zachycená pozvánka (QR vyfocený, odkaz přeposlaný) | cizí se připojí do rodiny | pozvánka jednorázová, platnost 24 h, zakladatel/admin nového člena potvrdí; klíč je ve fragmentu URL (`#`), který se neposílá na server |
| T6 | Útočník na síti | MITM | TLS (Cloudflare), certificate pinning nezavádíme (složitost), obsah je stejně E2E |
| T7 | Ukradený odemčený telefon | vidí polohu rodiny | mimo rozsah (stejné jako jiné aplikace); smazání zařízení z rodiny na dálku adminem |
| T8 | Zneužití API (spam kódů, DoS serveru) | výpadek, náklady na e-maily | rate limit na IP + e-mail, Cloudflare pravidla, limit výřezů map |
| T9 | Dítě pod 15 let | zpracování polohy bez souhlasu | účet dítěte zakládá rodič (souhlas), dítě vidí indikátor a o sdílení ví; žádné skryté režimy |

## 3. Návrh šifrování
- Knihovna: **`@noble/ciphers`** (čistý JavaScript, auditovaná), `xsalsa20poly1305` = stejný formát jako libsodium `crypto_secretbox`; náhodná čísla z `expo-crypto`. (Změna 2026-09-24: bez nativního modulu libsodium.)
- **Klíč rodiny** `K_family`: 32 B náhodný (`expo-crypto` getRandomBytes), vytvoří ho zakladatel na zařízení.
- Uložení: `expo-secure-store` (iOS Keychain / Android Keystore), nikdy v SQLite ani v záloze na server.
- **Pozvánka:** `https://api.rodinnapripravenost.cz/join#<familyId>.<inviteToken>.<base64url(K_family)>` (QR obsahuje totéž). Stránka `/join` jen předá fragment aplikaci (`app72h://join#…`); fragment se na server neposílá. Jakýkoli fotoaparát umí otevřít https odkaz.
  - `inviteToken` = jednorázový token pro server (připojení ke skupině), serveru se posílá jen ten.
  - Klíč je ve fragmentu → prohlížeč ani server ho nedostanou.
- **Šifrování dat:** `xsalsa20poly1305(K_family, nonce24).encrypt(plaintext)` (= `crypto_secretbox_easy`), nonce náhodný pro každou zprávu, uložen s ciphertextem.
  - Poloha: plaintext JSON `{lat, lon, accuracy, ts}` zaokrouhlený na ~10 m.
  - Server ukládá `(member_id, nonce, ciphertext, updated_at)` – **jediný řádek na člena**, UPSERT, žádná historie.
- **Verze klíče:** `key_version` u každého ciphertextu; při rotaci (T3) nová verze, staré záznamy se přepíšou při další aktualizaci, zbytek se smaže.
- **Rotace klíče (až po 1.0, viz R3):** admin vygeneruje nový klíč → sdílí ho zbylým členům přes **sealed box** na jejich veřejné klíče (`crypto_box_seal`). Každé zařízení má pár klíčů `crypto_box_keypair`, veřejný klíč je na serveru. (Alternativa jednodušší: nová pozvánka všem – horší UX.)

## 4. Rozhodnutí (2026-09-24)
Kritérium: co nejjednodušší kód a ovládání při zachování ochrany dat rodiny.

| # | Otázka | Rozhodnutí | Proč |
|---|---|---|---|
| R1+R2 | Co šifrovat end-to-end | **Všechno synchronizované** (lokality, zásoby, místa srazu, kontakty, poloha). Server drží jen `(family_id, record_id, type, updated_at, deleted, nonce, ciphertext)`, „poslední změna vyhrává“ podle `updated_at`. | Jeden stejný kód pro všechna data, server bez schémat pro jednotlivé typy, menší dopad úniku a jednodušší GDPR. Limity tarifů = počet záznamů daného typu. |
| R3 | Rotace klíče po odchodu člena | **V 1.0 bez sealed boxu.** Server odebranému členovi okamžitě zruší přístup a smaže jeho polohu. Volitelně „Vytvořit nový klíč rodiny“ = nová pozvánka ostatním (QR). | Odebraný člen se k datům po odebrání nedostane přes server; nový klíč je potřeba jen proti úniku celé databáze. Páry klíčů pro každé zařízení (sealed box) = velká složitost pro vzácnou situaci → případně později. |
| R4 | SSO a klíč | **Beze změny:** přihlášení jen identifikuje účet, klíč rodiny se přenáší pozvánkou/QR. | Server klíč nikdy neuvidí. |
| R5 | Záloha klíče (obnovovací QR) | **V 1.0 ne.** Klíč mají všechna zařízení rodiny – kdo ztratí telefon, naskenuje pozvánku od jiného člena. | Méně obrazovek a vysvětlování. Data jsou primárně v telefonu, server je jen synchronizace. Návrh na později, pokud o to lidé požádají. |

Důsledek: rodina s jediným zařízením, které ztratí, přijde o synchronizovaná data na serveru (v aplikaci to jednou větou vysvětlíme při zapnutí sdílení).

## 5. Poloha na pozadí – provozní pravidla (M6)
- Výchozí stav vypnuto; zapíná jen uživatel sám jedním přepínačem; při běhu je vidět stav „Sdílíš poslední polohu s rodinou“.
- iOS: `significant location change` + omezení na ~1×/h; Android: `expo-location` background s `distanceInterval: 1000` a `timeInterval: 3600000`, foreground service notifikace (Android to vyžaduje – slouží i jako indikátor).
- Jen „Při používání“ → aktualizace jen při otevření aplikace + vysvětlení.
- Server: žádné logy souřadnic (je to ciphertext), logy bez osobních údajů (jen member_id hash).
