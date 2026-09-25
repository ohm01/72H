# Nasazení a provoz serveru

**Mac** = vývoj (`~/projects/72h`, Docker přes OrbStack, Metro, simulátor).
**Hetzner Cloud `72h-prod`** = provoz (CAX11, Helsinky, Ubuntu 24.04, zálohy Hetzneru zapnuté).
**Raspberry Pi** = už ne pro 72h (běží na něm jen domácí knihovna – na ni nesahat).

Veřejná adresa API: `https://api.rodinnapripravenost.com` → Cloudflare tunel `72h-hetzner` → `localhost:8000` na serveru.
Na serveru je zvenku otevřené jen SSH (firewall `72h-ssh`, jen z IP uživatele).

## Kde jsou tajné údaje
| Co | Kde | Nikdy |
|---|---|---|
| Hesla DB, `AUTH_SECRET`, klíč e-mailové služby | `~/72h/.env` na serveru (práva 600, vytvoří `scripts/server-env.sh`) | v gitu, v chatu |
| Token tunelu Cloudflare | jen v systémové službě `cloudflared` na serveru | v gitu, v chatu |
| Hetzner API token | `hcloud` kontext `72h` na Macu | v gitu, v chatu |
| SSH klíč pro server | `~/.ssh/id_ed25519_72h_vps` na Macu | nikam nekopírovat |

## 1. Založení serveru (jednou)
Na Macu (potřebuje `hcloud context create 72h`):
```bash
scripts/create-server.sh            # CAX11 v hel1 se zálohami; jiný typ: scripts/create-server.sh cx23 nbg1
ssh app@<IP> cloud-init status --wait   # počkat na dokončení prvního spuštění (pár minut)
```
Server se nastaví sám (`deploy/cloud-init.yaml`): Docker, cloudflared, fail2ban, automatické bezpečnostní aktualizace,
uživatel `app` (jen SSH klíč), zakázané přihlášení roota a heslem, noční záloha databáze.

Tunel – token vloží uživatel sám přímo na serveru (Cloudflare → Zero Trust → Networks → Tunnels → `72h-hetzner` → Add a connector):
```bash
ssh app@<IP>
sudo cloudflared service install <TOKEN>
```

## 2. Nasazení nové verze
Na Macu (nasadí commitnutý stav `HEAD`; `.env`, `var/` a `maps/` na serveru zůstanou):
```bash
scripts/deploy.sh
```
Při prvním nasazení vytvoří `.env` s náhodnými hesly. E-mailovou službu doplníš: `ssh app@<IP> nano ~/72h/.env` → `docker compose up -d`.

## 3. Mapa ČR (jednou, pak občas obnovit)
Na serveru (stáhne výřez ČR z nejnovějšího Protomaps sestavení + písma, odhadem 1–3 GB):
```bash
cd ~/72h && scripts/fetch-cz-map.sh && docker compose up -d
```

## 4. Zálohy a obnova
- **Hetzner Backups:** denní záloha celého serveru, 7 dní zpět (Hetzner Console → server → Backups).
- **Noční záloha databáze:** `~/backups/72h-YYYYMMDD-HHMM.dump`, 14 dní (cron 3:30, log `~/backup.log`).
  Je i uvnitř záloh Hetzneru. Kopie mimo Hetzner (Cloudflare R2) až bude víc uživatelů.

Obnova databáze ze zálohy:
```bash
cd ~/72h
docker compose stop api
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < ~/backups/72h-YYYYMMDD-HHMM.dump
docker compose start api
```
Obnova celého serveru: Hetzner Console → server → Backups → Rebuild from backup.

## 5. Kontrola, že server běží a je zabezpečený
```bash
curl https://api.rodinnapripravenost.com/health        # {"status":"ok"}
ssh app@<IP> 'cd ~/72h && docker compose ps && tail -3 ~/backup.log'
ssh root@<IP>                                          # musí selhat (root zakázán)
ssh -o PubkeyAuthentication=no app@<IP>                # musí selhat (heslo zakázané)
ssh app@<IP> 'sudo fail2ban-client status sshd; systemctl is-active cloudflared unattended-upgrades'
```
Cloudflare → Tunnels → `72h-hetzner` musí být **Healthy**.
