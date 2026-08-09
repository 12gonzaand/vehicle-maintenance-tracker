PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vehicles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  year            INTEGER,
  make            TEXT,
  model           TEXT,
  vin             TEXT,
  current_mileage INTEGER,
  photo_path      TEXT,
  archived        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS service_types (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS service_records (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id   INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  service_date TEXT NOT NULL,
  mileage      INTEGER,
  cost         REAL,
  notes        TEXT,
  shop         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_service_records_vehicle_date
  ON service_records(vehicle_id, service_date);

-- Many-to-many: a single record (one shop visit / one bill) can cover
-- several service types (e.g. oil change + tire rotation on the same
-- receipt) instead of forcing one record per type.
CREATE TABLE IF NOT EXISTS service_record_types (
  service_record_id INTEGER NOT NULL REFERENCES service_records(id) ON DELETE CASCADE,
  service_type_id    INTEGER NOT NULL REFERENCES service_types(id) ON DELETE CASCADE,
  PRIMARY KEY (service_record_id, service_type_id)
);

CREATE TABLE IF NOT EXISTS service_files (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  service_record_id INTEGER NOT NULL REFERENCES service_records(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_path       TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  size_bytes        INTEGER NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_service_files_record
  ON service_files(service_record_id);

CREATE TABLE IF NOT EXISTS mileage_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  mileage    INTEGER NOT NULL,
  log_date   TEXT NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mileage_logs_vehicle_date
  ON mileage_logs(vehicle_id, log_date);

CREATE TABLE IF NOT EXISTS fuel_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  fill_date   TEXT NOT NULL,
  mileage     INTEGER NOT NULL,
  gallons     REAL NOT NULL,
  cost        REAL,
  fuel_grade  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_mileage
  ON fuel_logs(vehicle_id, mileage);

CREATE TABLE IF NOT EXISTS reminder_rules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  service_type    TEXT NOT NULL,
  interval_miles  INTEGER,
  interval_months INTEGER,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
