PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vehicles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS service_records (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id   INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS reminder_rules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  service_type    TEXT NOT NULL,
  interval_miles  INTEGER,
  interval_months INTEGER,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO service_types (name) VALUES
  ('Oil Change'),
  ('Tire Rotation'),
  ('Brake Pads'),
  ('Brake Fluid'),
  ('Air Filter'),
  ('Cabin Air Filter'),
  ('Battery'),
  ('Coolant Flush'),
  ('Transmission Fluid'),
  ('Spark Plugs'),
  ('Wiper Blades'),
  ('Alignment'),
  ('Registration'),
  ('Inspection'),
  ('Tire Replacement');
