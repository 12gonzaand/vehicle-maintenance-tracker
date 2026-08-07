# Maintenance Tracker

Self-hosted web app for tracking maintenance on personal vehicles. Node.js + Express + SQLite, gated by per-user accounts (intended for access over Tailscale only). Multiple people can share one server, each with their own login and their own private set of vehicles.

## Features

- Vehicles with photos, service records (with receipt/invoice file attachments), mileage history, and per-tank fuel log tracking (grade, cost, gallons, mileage — auto-computes MPG per fill-up plus a running average, charted).
- Maintenance reminders: per-vehicle rules ("every 5,000 mi" and/or "every 6 months" for a given service type), tracked against the most recent matching service record and shown as OK / Due soon / Overdue.
- Multi-user: anyone who can reach the server can register their own account at `/register`; each account's vehicles, records, and files are fully isolated from every other account's.
- Session-based login with per-IP rate limiting (5 failed attempts locks that IP out for 10 minutes).

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` if you want to change the port, database location, or uploads directory:

```
# HOST should be your Tailscale interface IP (`tailscale ip -4`), not 0.0.0.0 —
# binding to 0.0.0.0 exposes this app on every local network interface, not just Tailscale.
PORT=3003
HOST=100.100.108.1
DB_PATH=./data/maintenance.sqlite
UPLOADS_DIR=./uploads
MAX_FILE_SIZE_MB=15
```

No auth secrets belong in `.env`. The session secret is generated automatically on first run and written to `.env.local` (gitignored); each account's username/password is stored (bcrypt-hashed) in the SQLite database, created via the registration screen described below.

The app serves HTTPS only, using a cert in `certs/` (gitignored). This must be a real Tailscale-issued cert, not a self-signed one, or browsers show a permanent security warning. Set it up once:

1. In the [Tailscale admin console](https://login.tailscale.com/admin/dns), enable **MagicDNS**, then enable **HTTPS Certificates** (requires MagicDNS).
2. Issue the cert for this node's MagicDNS name (find it with `tailscale status`, e.g. `andrews-home-server.tailf850c4.ts.net`):

```bash
mkdir -p certs
tailscale cert --cert-file certs/cert.pem --key-file certs/key.pem <your-tailscale-magicdns-name>
```

The app must be accessed via that MagicDNS hostname, not the raw Tailscale IP — the cert is issued per-hostname and won't validate against an IP.

HTTPS is required so phone browsers (Android in particular) treat the page as a secure context — otherwise the camera/file-capture APIs used for receipt and vehicle photos are blocked entirely.

Tailscale certs expire periodically and need renewal — see [Cert renewal](#cert-renewal) below for the automated setup.

## Run

```bash
npm start
```

The database schema is applied automatically on startup (safe to run repeatedly — additive changes use `CREATE TABLE IF NOT EXISTS`; any one-time structural migrations, like the move to per-user accounts, are guarded so they only apply once). The app will be available at `https://<your-tailscale-magicdns-name>:<PORT>` over your Tailscale network (see the cert setup above for why it must be the MagicDNS name and not the IP), or `https://localhost:3003` locally.

Visit `/register` to create an account (username + password, min 8 characters) — anyone who can reach the server this way can make their own account, since the real access control is the Tailscale network itself, not the login screen. After that, every visit requires logging in with those credentials. Five incorrect attempts from an IP locks that IP out for 10 minutes.

If you forget your password, reset it from the server (this only resets an *existing* account's password — it won't create a new one; use `/register` for that):

```bash
npm run reset-password
```

This prompts for a username, confirms the account exists, then prompts for and sets a new password. Restart the service afterward to log out any existing sessions.

For local development with auto-restart on file changes:

```bash
npm run dev
```

## Running as a persistent service (systemd)

Runs as a `systemd --user` service — no root/sudo required. Unit file goes at `~/.config/systemd/user/maintenance-tracker.service`:

```ini
[Unit]
Description=Vehicle Maintenance Tracker
After=network.target

[Service]
WorkingDirectory=/home/andrew/maintenance-tracker
ExecStart=/home/andrew/.nvm/versions/node/v24.18.0/bin/node src/server.js
Restart=on-failure
EnvironmentFile=/home/andrew/maintenance-tracker/.env

[Install]
WantedBy=default.target
```

`ExecStart` must point at the real node binary — this box installs node via nvm, so `/usr/bin/node` doesn't exist. Check yours with `which node`.

Then:

```bash
systemctl --user daemon-reload
systemctl --user enable --now maintenance-tracker
```

For the service to keep running after you log out (or across a reboot without logging in), enable lingering once:

```bash
loginctl enable-linger andrew
```

Useful commands:

```bash
systemctl --user status maintenance-tracker
systemctl --user restart maintenance-tracker
journalctl --user -u maintenance-tracker -f
```

A `git push` alone does **not** update the running app — restart the service afterward to pick up new code.

### Cert renewal

Tailscale-issued certs expire periodically. `scripts/renew-cert.sh` re-issues the cert (a no-op unless it's within 30 days of expiring) and restarts `maintenance-tracker.service` only if the key actually changed. Automate it with a second `systemd --user` timer, `~/.config/systemd/user/maintenance-tracker-cert-renew.service`:

```ini
[Unit]
Description=Renew Tailscale TLS cert for maintenance-tracker

[Service]
Type=oneshot
ExecStart=/home/andrew/maintenance-tracker/scripts/renew-cert.sh
```

and `~/.config/systemd/user/maintenance-tracker-cert-renew.timer`:

```ini
[Unit]
Description=Weekly renewal check for maintenance-tracker Tailscale TLS cert

[Timer]
OnCalendar=weekly
Persistent=true
RandomizedDelaySec=1h

[Install]
WantedBy=timers.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now maintenance-tracker-cert-renew.timer
```

Requires lingering (`loginctl enable-linger andrew`, see above) so the timer fires even when logged out. Check on it with `systemctl --user list-timers` or `journalctl --user -u maintenance-tracker-cert-renew -f`.

## Backing up

Everything that matters lives in two places:

- **`data/maintenance.sqlite`** — the database (accounts, vehicles, service records, mileage logs, fuel logs). SQLite runs in WAL mode here, so a plain file copy while the app is running can miss recent writes sitting in the `-wal`/`-shm` sidecar files — either stop the app first and copy all three (`maintenance.sqlite`, `-wal`, `-shm`), or use `sqlite3 data/maintenance.sqlite ".backup data/backup.sqlite"` to snapshot safely while it's running.
- **`uploads/`** — all receipt/invoice files and vehicle photos, organized as `uploads/vehicles/<vehicle_id>/records/<record_id>/<filename>`.

A simple periodic backup:

```bash
tar czf maintenance-backup-$(date +%Y%m%d).tar.gz data/maintenance.sqlite uploads/
```

Restoring is the reverse: stop the app, extract the tarball back into place, restart.

## Project Structure

```
src/
  app.js              Express app setup (middleware, routes, ownership-checked file serving)
  server.js            Entrypoint — runs migrations, starts the HTTP server
  db/
    schema.sql          Table definitions
    migrate.js           Applies schema.sql on startup, plus one-time guarded migrations (e.g. the multi-user upgrade)
    index.js              better-sqlite3 connection
  models/               Data access per table (user, vehicle, serviceRecord, serviceFile, mileageLog, fuelLog, serviceType, reminderRule)
  routes/               Express routers (auth, vehicles, serviceRecords, mileageLogs, fuelLogs, reminderRules)
  lib/
    auth.js               Password hashing/verification, session secret, login lockout, requireAuth middleware
  middleware/
    upload.js            multer config — file type/size validation, per-vehicle/per-record storage paths
    ownership.js          Loads a vehicle from :vehicleId and 404s unless it belongs to the logged-in user
  views/                EJS templates (server-rendered)
  public/               Static CSS/JS (table sort/filter is server-side via query params; mileage and fuel-efficiency charts are small canvas scripts)
scripts/
  reset-password.js      Resets an existing account's password
  renew-cert.sh           Re-issues the Tailscale TLS cert and restarts the service if it changed (see Cert renewal)
uploads/                Uploaded files, gitignored
data/                  SQLite database file, gitignored
certs/                 TLS cert/key, gitignored
```

## Notes

- Multi-user accounts (`bcrypt` + `express-session`), stored in the database. Every vehicle — and everything nested under one (service records, files, mileage logs, fuel logs, service types) — is scoped to the account that owns it; ownership is checked on every route that takes a vehicle id or a resource nested under one, including file downloads. Access control still primarily comes from the network (Tailscale ACLs / not exposing the port publicly); accounts are a second layer (data isolation between the people you've let onto your tailnet), not a substitute. Failed logins are rate-limited per IP (5 attempts, then a 10-minute lockout).
- File uploads accept JPG, PNG, and PDF only, capped at `MAX_FILE_SIZE_MB` (default 15MB).
- Vehicle `current_mileage` is automatically bumped whenever a new service record, mileage log, or fuel log entry has a higher mileage than what's on file.
- Fuel log MPG is computed per fill-up (assumes each entry is a full-tank fill) as the mileage delta since the previous fill divided by gallons, plus a running average across all fill-ups — both charted on the vehicle page.
- Maintenance reminders are rules of the form "every N miles" and/or "every N months" for a service type, evaluated against that vehicle's `current_mileage` and the most recent service record of the same type. A rule with no matching service record yet shows "No baseline" rather than a false due date. There's no notification/email — reminders only surface as a status badge (OK / Due soon / Overdue) on the vehicle page.
