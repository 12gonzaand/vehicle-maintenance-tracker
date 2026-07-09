# Maintenance Tracker

Self-hosted web app for tracking maintenance on personal vehicles. Node.js + Express + SQLite, no auth (intended for access over Tailscale only).

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` if you want to change the port, database location, or uploads directory:

```
PORT=3003
HOST=0.0.0.0
DB_PATH=./data/maintenance.sqlite
UPLOADS_DIR=./uploads
MAX_FILE_SIZE_MB=15
```

## Run

```bash
npm start
```

The database schema is applied automatically on startup (safe to run repeatedly — uses `CREATE TABLE IF NOT EXISTS`). The app will be available at `http://<HOST>:<PORT>`, e.g. `http://<your-tailscale-ip>:3003` over your Tailscale network, or `http://localhost:3003` locally.

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

## Backing up

Everything that matters lives in two places:

- **`data/maintenance.sqlite`** — the database (vehicles, service records, mileage logs). SQLite is a single file, so backing it up is just copying it. Stop the app first, or use `sqlite3 data/maintenance.sqlite ".backup data/backup.sqlite"` to snapshot safely while it's running.
- **`uploads/`** — all receipt/invoice files and vehicle photos, organized as `uploads/vehicles/<vehicle_id>/records/<record_id>/<filename>`.

A simple periodic backup:

```bash
tar czf maintenance-backup-$(date +%Y%m%d).tar.gz data/maintenance.sqlite uploads/
```

Restoring is the reverse: stop the app, extract the tarball back into place, restart.

## Project Structure

```
src/
  app.js              Express app setup (middleware, routes, static files)
  server.js            Entrypoint — runs migrations, starts the HTTP server
  db/
    schema.sql          Table definitions
    migrate.js           Applies schema.sql on startup
    index.js              better-sqlite3 connection
  models/               Data access per table (vehicle, serviceRecord, serviceFile, mileageLog, serviceType)
  routes/               Express routers (vehicles, serviceRecords, mileageLogs)
  middleware/
    upload.js            multer config — file type/size validation, per-vehicle/per-record storage paths
  views/                EJS templates (server-rendered)
  public/               Static CSS/JS (table sort/filter is server-side via query params; mileage chart is a small canvas script)
uploads/                Uploaded files, gitignored
data/                  SQLite database file, gitignored
```

## Notes

- No authentication — access control is expected to come from the network (Tailscale ACLs / not exposing the port publicly).
- File uploads accept JPG, PNG, and PDF only, capped at `MAX_FILE_SIZE_MB` (default 15MB).
- Vehicle `current_mileage` is automatically bumped whenever a new service record or mileage log entry has a higher mileage than what's on file.
- Maintenance reminders (mileage/time-interval based) are not implemented in v1; the `reminder_rules` table exists in the schema for future use.
