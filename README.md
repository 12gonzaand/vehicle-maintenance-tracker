# Maintenance Tracker

Self-hosted web app for tracking maintenance on personal vehicles. Node.js + Express + SQLite, gated by per-user accounts. Multiple people can share one server, each with their own login and their own private set of vehicles. Designed for access over Tailscale; optionally also reachable over the public internet via a Cloudflare Tunnel (see [Public access via Cloudflare Tunnel](#public-access-via-cloudflare-tunnel-optional)) for sharing with people who don't want to install Tailscale.

## Features

- Vehicles with photos, service records (with receipt/invoice file attachments, and support for multiple service types on one record — e.g. an oil change and a tire rotation on the same bill, instead of needing a separate record per service), mileage history, and per-tank fuel log tracking (grade, cost, gallons, mileage — auto-computes MPG per fill-up plus a running average, charted).
- Optional: scan one or more receipt photos to auto-fill the fuel log or service record form (see [Receipt scanning](#receipt-scanning-optional)) — Gemini's free tier reads the fields off the photo(s), you review/correct before saving.
- Maintenance reminders: per-vehicle rules ("every 5,000 mi" and/or "every 6 months" for a given service type), tracked against the most recent matching service record and shown as OK / Due soon / Overdue.
- Multi-user: anyone who can reach the server can register their own account at `/register`; each account's vehicles, records, and files are fully isolated from every other account's.
- Session-based login with per-IP rate limiting (5 failed attempts locks that IP out for 10 minutes).
- `/settings` lets each account pick a Light/Dark/System theme and customize the header text (shown only to that account, e.g. a shop name) — both stored per-user, so sharing a server doesn't mean sharing a look.

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
HOST=100.x.x.x
DB_PATH=./data/maintenance.sqlite
UPLOADS_DIR=./uploads
MAX_FILE_SIZE_MB=15
```

No auth secrets belong in `.env`. The session secret is generated automatically on first run and written to `.env.local` (gitignored); each account's username/password is stored (bcrypt-hashed) in the SQLite database, created via the registration screen described below.

The app serves HTTPS on your Tailscale interface, using a cert in `certs/` (gitignored). This must be a real Tailscale-issued cert, not a self-signed one, or browsers show a permanent security warning. (It also listens on plain HTTP on `127.0.0.1` only, for the optional Cloudflare Tunnel path below — that listener is unreachable from outside the box.) Set up the Tailscale cert once:

1. In the [Tailscale admin console](https://login.tailscale.com/admin/dns), enable **MagicDNS**, then enable **HTTPS Certificates** (requires MagicDNS).
2. Issue the cert for this node's MagicDNS name (find it with `tailscale status`, e.g. `my-server.abc123de.ts.net`):

```bash
mkdir -p certs
tailscale cert --cert-file certs/cert.pem --key-file certs/key.pem <your-tailscale-magicdns-name>
```

The app must be accessed via that MagicDNS hostname, not the raw Tailscale IP — the cert is issued per-hostname and won't validate against an IP.

HTTPS is required so phone browsers (Android in particular) treat the page as a secure context — otherwise the camera/file-capture APIs used for receipt and vehicle photos are blocked entirely.

Tailscale certs expire periodically and need renewal — see [Cert renewal](#cert-renewal) below for the automated setup.

## Receipt scanning (optional)

"Scan receipt to autofill" on the fuel log and Add Service Record forms
sends the receipt photo (or photos — see multi-page below) to Google's
Gemini API (free tier) and uses the extracted fields to pre-fill the
form — you still review and correct before saving, it never submits
anything on its own.

1. Get a free API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (no GCP billing account needed).
2. Add it to `.env`:

```
GEMINI_API_KEY=your-key-here
```

3. Restart the service. If `GEMINI_API_KEY` is unset, the scan button just
   shows a "not configured" message — every form still works exactly as
   it did before this feature existed, nothing is required.

**Model used:** defaults to `gemini-flash-latest`, a Google-maintained
alias that always points at their current recommended flash-tier model,
rather than a pinned version — pinned versions can get deprecated for new
API keys over time (hit this directly during development: `gemini-2.5-flash`
404'd with "no longer available to new users" despite still being listed
by Gemini's own models API). `GEMINI_MODEL` in `.env` overrides this if
you'd rather pin a specific version anyway.

**Multi-page receipts:** both scan buttons accept more than one photo at
once (up to 6) — useful for an invoice photographed as separate pages
(e.g. an itemized page plus a totals page). All selected images are sent
together and read as one receipt, not scanned separately.

**Multiple service types per bill:** the Add Service Record form shows a
checkbox for every known service type, plus a free-text "Other" field for
anything not listed — check as many as the bill actually covers (e.g. oil
change + tire rotation + air filter on one visit). Scanning a receipt
automatically checks every service type Gemini identifies across all the
photos you selected, dropping anything not already in your list into
"Other" instead of guessing a checkbox for it.

For service records, the receipt photo(s) are both scanned **and** saved
as a permanent attachment (same as it always was) — scanning doesn't
change that. Fuel log receipts are **scan-only**: sent to Gemini purely to
read the numbers off, then discarded — nothing new is stored for fuel
logs, since they had no attachment storage before this feature either.

**Privacy note:** the receipt photo(s) are sent to Google's Gemini API for
this to work — worth knowing since receipts occasionally show partial
card numbers or other personal details. Free-tier usage limits are
Google's to enforce; this app adds no additional rate-limiting beyond the
existing login/network access controls.

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

### Inviting people who aren't on your tailnet

Access here has two layers: Tailscale decides who can *reach* the server at all, the app's login decides *whose data is whose* once they're in. Multi-user accounts (above) only help with the second layer — someone still needs Tailscale connectivity to this machine before `/register` means anything to them. To add someone who isn't already a member of your tailnet:

1. In the [Tailscale admin console](https://login.tailscale.com/admin/machines), find this machine → **⋯** → **Share...** → send an invite to their email. This is a single-device share, not a full tailnet invite — it doesn't give them access to your other devices.
2. They install Tailscale (Android/iOS/desktop), accept the invite, and connect.
3. They open `https://<your-tailscale-magicdns-name>:<PORT>` and register their own account at `/register`.

**Security note:** plain device sharing gives the recipient network reachability to *every* port listening on that machine's Tailscale IP, not just this app's port — if the box also runs SSH, other web apps, a media server, etc., a shared recipient can reach those too (they'd still need real credentials to do anything with them, but they can hit the front door). Fine for one or two trusted people and a box that only runs this app; worth a second look if the box runs anything sensitive. Tailscale can scope a shared recipient down to a single port via an ACL grant keyed to their email and the server's Tailscale IP — tags are stripped for external shared users, so the rule has to target the IP directly, not a tag:

```json
"grants": [
  {
    "src": ["friend@example.com"],
    "dst": ["100.x.x.x"],
    "ip": ["<port>"]
  }
]
```

Replace `100.x.x.x` with this machine's Tailscale IP (`tailscale ip -4`) and `<port>` with the app's port. See [Tailscale's grants syntax docs](https://tailscale.com/docs/reference/syntax/grants) for the full policy file format.

## Public access via Cloudflare Tunnel (optional)

Sharing over Tailscale (above) is free but requires everyone to install
Tailscale. If you'd rather share with people who won't do that, Cloudflare
Tunnel exposes the app at a normal public HTTPS URL, without opening any
ports on your router. This is entirely additive — the Tailscale HTTPS setup
above keeps working unchanged; this just adds a second way in.

**You need your own domain in your own Cloudflare account for this** —
domains can't be shared across separate deployments, so anyone self-hosting
their own instance of this app needs to bring their own (buy a cheap one,
~$2–12/yr depending on TLD, through Cloudflare Registrar or anywhere else
with its nameservers pointed at Cloudflare — both free to add).

The app itself listens on plain HTTP on `127.0.0.1` for this path (see
`src/server.js`) — Cloudflare terminates TLS at its edge, so the app never
handles a cert for public traffic; `cloudflared` is the only thing that can
reach that loopback listener.

1. Add your domain to Cloudflare as a zone if it isn't already.
2. In [Zero Trust → Access → Applications](https://one.dash.cloudflare.com/),
   create a "Self-hosted" application for the hostname you want (e.g.
   `maintenance.yourdomain.com`), with a policy allowlisting specific
   emails. This is the layer that decides who can reach the app publicly at
   all — the equivalent of Tailscale network membership for this path. The
   app's own login (below) still decides *whose data is whose* once someone
   is through; `/register` stays open the same way it does on the Tailscale
   path, because Access is already gating who gets there.

   **Gotcha:** a brand new Zero Trust account only has the "Cloudflare"
   identity provider available (i.e. logging in with an actual Cloudflare
   account) — not what you want for inviting people who don't have one.
   Add **One-Time PIN** under **Team & Resources → Identity providers**
   (no config needed, just add it) so the login screen offers an
   email-a-code option instead. Test in a private browser window — testing
   in a normal window while you're logged into the Cloudflare dashboard can
   mask this, since it may offer to sign you in as your own account instead
   of showing the actual login screen a new visitor would see.
3. Install `cloudflared` on the server (Cloudflare's apt repo or a direct
   binary download — a one-time root-level package install).

   **Gotcha:** if the server is running a very new Ubuntu release,
   `lsb_release -cs` may resolve to a codename Cloudflare's repo hasn't
   published yet, causing a 404 on `apt-get update`. Check what codenames
   actually exist first: `curl -s -o /dev/null -w '%{http_code}\n'
   https://pkg.cloudflare.com/cloudflared/dists/noble/Release` (swap
   `noble` for other codenames as needed). If your real codename 404s, pin
   the apt source to the newest one that returns `200` instead —
   `cloudflared` is a static binary with no distro-specific dependencies,
   so an older codename works fine on a newer host.
4. `cloudflared tunnel login` — opens a browser for a one-time OAuth flow
   authorizing this box against your Cloudflare account.
5. `cloudflared tunnel create maintenance-tracker` — creates the tunnel and
   a credentials file under `~/.cloudflared/`.
6. Create `~/.cloudflared/config.yml`:

   ```yaml
   tunnel: maintenance-tracker
   credentials-file: /home/<youruser>/.cloudflared/<tunnel-id>.json

   ingress:
     - hostname: maintenance.yourdomain.com
       service: http://127.0.0.1:3003
     - service: http_status:404
   ```

7. `cloudflared tunnel route dns maintenance-tracker maintenance.yourdomain.com`
   — creates the DNS record automatically.
8. Run it as a `systemd --user` service, the same pattern as
   `maintenance-tracker.service` (not `cloudflared service install`, which
   installs as a root-level system service instead):

   ```ini
   [Unit]
   Description=Cloudflare Tunnel for maintenance-tracker
   After=network.target

   [Service]
   ExecStart=/usr/bin/cloudflared tunnel run maintenance-tracker
   Restart=on-failure

   [Install]
   WantedBy=default.target
   ```

   ```bash
   systemctl --user daemon-reload
   systemctl --user enable --now cloudflared-maintenance-tracker
   ```

**Future hardening to consider, not required to get this working:**
Cloudflare's WAF and rate-limiting rules can add an edge-level layer in
front of the app's own login lockout (5 attempts / 10-minute lockout) once
this hostname sees real public traffic.

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
WorkingDirectory=/home/<youruser>/maintenance-tracker
ExecStart=/home/<youruser>/.nvm/versions/node/v24.18.0/bin/node src/server.js
Restart=on-failure
EnvironmentFile=/home/<youruser>/maintenance-tracker/.env

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
loginctl enable-linger <youruser>
```

Useful commands:

```bash
systemctl --user status maintenance-tracker
systemctl --user restart maintenance-tracker
journalctl --user -u maintenance-tracker -f
```

A `git push` alone does **not** update the running app — restart the service afterward to pick up new code.

### Cert renewal

Tailscale-issued certs expire periodically. `scripts/renew-cert.sh` re-issues the cert (a no-op unless it's within 30 days of expiring) and restarts `maintenance-tracker.service` only if the key actually changed. It reads the MagicDNS name to renew from `CERT_DOMAIN` in `.env` (same value you used in step 2 of the cert setup above). Automate it with a second `systemd --user` timer, `~/.config/systemd/user/maintenance-tracker-cert-renew.service`:

```ini
[Unit]
Description=Renew Tailscale TLS cert for maintenance-tracker

[Service]
Type=oneshot
ExecStart=/home/<youruser>/maintenance-tracker/scripts/renew-cert.sh
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

Requires lingering (`loginctl enable-linger <youruser>`, see above) so the timer fires even when logged out. Check on it with `systemctl --user list-timers` or `journalctl --user -u maintenance-tracker-cert-renew -f`.

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
  routes/               Express routers (auth, vehicles, serviceRecords, mileageLogs, fuelLogs, reminderRules, receiptScan)
  lib/
    auth.js               Password hashing/verification, session secret, login lockout, requireAuth middleware
    receiptScan.js         Calls Gemini's API to extract fields from receipt photo(s) (see Receipt scanning above)
  middleware/
    upload.js            multer config — file type/size validation, per-vehicle/per-record storage paths, plus an in-memory uploader for receipt scanning (never written to disk)
    ownership.js          Loads a vehicle from :vehicleId and 404s unless it belongs to the logged-in user
  views/                EJS templates (server-rendered)
  public/               Static CSS/JS (table sort/filter is server-side via query params; mileage/fuel-efficiency charts and receipt-scan are small vanilla-JS scripts, no framework/bundler)
scripts/
  reset-password.js      Resets an existing account's password
  renew-cert.sh           Re-issues the Tailscale TLS cert and restarts the service if it changed (see Cert renewal)
uploads/                Uploaded files, gitignored
data/                  SQLite database file, gitignored
certs/                 TLS cert/key, gitignored
```

## Notes

- Multi-user accounts (`bcrypt` + `express-session`), stored in the database. Every vehicle — and everything nested under one (service records, files, mileage logs, fuel logs, service types) — is scoped to the account that owns it; ownership is checked on every route that takes a vehicle id or a resource nested under one, including file downloads. Access control still primarily comes from the network layer — Tailscale ACLs for the Tailscale path, Cloudflare Access for the optional public-tunnel path — not exposing the port publicly on its own; accounts are a second layer (data isolation between the people you've let in), not a substitute. Failed logins are rate-limited per IP (5 attempts, then a 10-minute lockout) — for requests arriving via the Cloudflare tunnel, this is keyed on Cloudflare's `CF-Connecting-IP` header rather than the loopback address `cloudflared` connects from (see `clientIp()` in `src/lib/auth.js`).
- Every response sets `X-Frame-Options: DENY` and a `frame-ancestors 'none'` CSP, so the app can't be iframed by another site for a clickjacking/click-redress attack — nothing here is meant to be embedded elsewhere. Unhandled request errors (e.g. invalid input reaching a `NOT NULL` database column) return a generic message to the client instead of the raw exception; the real error still goes to the server log.
- File uploads accept JPG, PNG, and PDF only, capped at `MAX_FILE_SIZE_MB` (default 15MB).
- Vehicle `current_mileage` is automatically bumped whenever a new service record, mileage log, or fuel log entry has a higher mileage than what's on file.
- Fuel log MPG is computed per fill-up (assumes each entry is a full-tank fill) as the mileage delta since the previous fill divided by gallons, plus a running average across all fill-ups — both charted on the vehicle page.
- Maintenance reminders are rules of the form "every N miles" and/or "every N months" for a service type, evaluated against that vehicle's `current_mileage` and the most recent service record that includes that type — a record can cover more than one type (see Features above), so a reminder matches any record it was part of, not only a record whose sole type was that one. A rule with no matching service record yet shows "No baseline" rather than a false due date. There's no notification/email — reminders only surface as a status badge (OK / Due soon / Overdue) on the vehicle page.
