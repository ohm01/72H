# Zásady ochrany osobních údajů – 72h (KONCEPT)

> Koncept k právní kontrole (stav 2026-09-25, podle skutečného fungování aplikace a serveru).
> Doplnit: adresa správce, datum účinnosti, e-mailová služba (Brevo/Resend). Finální verze bude na webu aplikace česky a anglicky.

**Správce:** Jan Ježek, [DOPLNIT adresa]
**Kontakt:** info@rodinnapripravenost.com
**Účinnost od:** [DOPLNIT]

## 1. Stručně
- **Aplikace funguje bez účtu.** Zásoby, místa srazu, kontakty, checklist, stažené mapy i vaše poloha pro šipku k místu srazu zůstávají jen ve vašem telefonu.
- **Sdílení s rodinou je dobrovolné.** Když ho zapnete, data rodiny se před odesláním zašifrují klíčem, který má jen vaše rodina. My je přečíst nemůžeme – vidíme jen, že nějaký záznam existuje, jak je velký a kdy se změnil.
- Data neprodáváme, nepoužíváme k reklamě ani k profilování a aplikace neobsahuje žádné analytické nebo reklamní nástroje.

## 2. Co zůstává jen ve vašem telefonu
| Údaj | K čemu |
|---|---|
| Zásoby, místa zásob, krizová zavazadla, checklist | přehled a výpočet, na kolik dní jste zásobeni |
| Místa srazu, kontakty rodiny, zpráva pro děti | navigace a obrazovka pro děti |
| Poloha z GPS a kompas | modrá tečka na mapě a šipka k místu srazu; nikam se neodesílá |
| Stažené mapy | mapa bez internetu |
| Anonymní identifikátor zařízení | náhodné číslo vytvořené aplikací (ne identifikátor výrobce), viz níže |

Tato data smažete odinstalováním aplikace.

## 3. Co zpracováváme na serveru
| Údaj | Proč | Právní základ | Jak dlouho |
|---|---|---|---|
| Anonymní identifikátor zařízení, otisk staženého výřezu mapy, čas | měsíční limit stahování map bez účtu | oprávněný zájem (ochrana serveru před zneužitím) | 2 měsíce |
| Hranice obdélníku mapy, který stahujete | vyříznout mapu vaší oblasti | plnění smlouvy | výřez je na serveru nejvýše 24 hodin; k vašemu zařízení se ukládá jen jeho otisk |
| E-mail | přihlášení kódem; **vidí ho i členové vaší rodiny** | plnění smlouvy | do smazání účtu |
| Přihlašovací kód | ověření e-mailu | plnění smlouvy | jen jako otisk (hash), nejvýše 1 den |
| Přihlášená zařízení (typ systému, kdy vzniklo a kdy bylo naposledy použito) | udržet vás přihlášené | plnění smlouvy | do odhlášení, 365 dní nečinnosti nebo smazání účtu |
| Členství v rodině (role, čeká na schválení / aktivní) | fungování rodinné skupiny | plnění smlouvy | do odchodu z rodiny nebo smazání účtu |
| Šifrovaná data rodiny (kontakty, zásoby, místa zásob, místa srazu) | synchronizace mezi telefony rodiny | plnění smlouvy | do smazání záznamu; při zániku rodiny se smažou všechna |
| Technické záznamy serveru (čas, adresa požadavku, výsledek – bez obsahu a bez polohy) | provoz a bezpečnost | oprávněný zájem | průběžně se přepisují (nejvýše desítky MB) |

**Zálohy:** databázi zálohujeme každou noc (14 dní) a celý server denně (7 dní). Smazané údaje proto mohou v zálohách zůstat nejdéle 14 dní, pak zmizí.

**Připravujeme (až budou funkce dostupné):** šifrovaná poslední známá poloha člena rodiny (dobrovolná, ve výchozím stavu vypnutá, bez historie) a stav předplatného Plus. Zásady před spuštěním doplníme.

## 4. Kdo další údaje zpracovává
| Příjemce | Co a proč | Kde |
|---|---|---|
| Hetzner Online GmbH | provoz našeho serveru | datacentrum v Helsinkách (Finsko, EU) |
| Cloudflare, Inc. | bezpečné připojení k serveru, DNS, přeposílání e-mailů na info@ | USA – přenos podle EU-US Data Privacy Framework a standardních smluvních doložek |
| [DOPLNIT: Brevo / Resend] | odeslání e-mailu s přihlašovacím kódem | [DOPLNIT] |
| Apple / Google | **vyhledání adresy:** když napíšete adresu (místo srazu, kontakt, oblast mapy), systém telefonu ji převede na polohu přes službu Applu (iOS) nebo Googlu (Android) | podle podmínek Applu a Googlu |
| Apple App Store / Google Play | stažení aplikace (a později platby) | podle podmínek obchodů |

Mapová data: © přispěvatelé OpenStreetMap (ODbL), zpracování Protomaps. Při stažení mapy se vaše údaje k nim neposílají – výřez připraví náš server.

## 5. Děti a rodina
- Účet a rodinnou skupinu zakládá dospělý; u dětí mladších 15 let rozhoduje rodič.
- Nového člena rodiny musí schválit správce rodiny. Odebraný člen okamžitě ztrácí přístup k datům rodiny na serveru.
- Aplikace nesmí sloužit ke skrytému sledování.

## 6. Vaše práva
Máte právo na přístup, opravu, výmaz, omezení zpracování, přenositelnost, námitku a stížnost u Úřadu pro ochranu osobních údajů (www.uoou.cz).
- **Údaje na serveru zobrazíte / stáhnete:** Rodina → Sdílet s rodinou → Moje data na serveru.
- **Smazání účtu:** Rodina → Sdílet s rodinou → Smazat účet. Smaže účet, přihlášená zařízení a členství; pokud jste v rodině poslední, smaže i všechna data rodiny.
- Ostatní žádosti: info@rodinnapripravenost.com.

## 7. Upozornění
72h je pomůcka pro přípravu, ne oficiální varovný systém. V nouzi volejte 112.
