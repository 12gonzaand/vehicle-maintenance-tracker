const fs = require('fs');
const path = require('path');
const db = require('./index');

function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  migrateToMultiUser();
  migrateServiceTypeToJunctionTable();
}

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

// One-time, idempotent upgrade from the old single-tenant shape (one
// hardcoded login in `settings`, no ownership on any row) to per-user data.
// Safe to run on every startup: each step checks whether it's already been
// applied before touching anything. Fresh installs never hit any of this —
// schema.sql above already creates users/vehicles/service_types in their
// final shape, so hasColumn() is already true and every branch here is a
// no-op.
function migrateToMultiUser() {
  if (!hasColumn('vehicles', 'user_id')) {
    db.exec('ALTER TABLE vehicles ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
  }

  const legacyOwnerId = ensureLegacyUser();

  if (legacyOwnerId != null) {
    db.prepare('UPDATE vehicles SET user_id = ? WHERE user_id IS NULL').run(legacyOwnerId);
  }

  if (!hasColumn('service_types', 'user_id')) {
    migrateServiceTypesToPerUser(legacyOwnerId);
  }
}

// Promotes the old settings-table single login into the first row of
// `users`, preserving its exact bcrypt hash so the existing password keeps
// working. Returns that user's id (existing or newly created), or null if
// there's no legacy account to migrate and none exists yet.
function ensureLegacyUser() {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount > 0) {
    return db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get().id;
  }

  const username = db.prepare(`SELECT value FROM settings WHERE key = 'auth_username'`).get();
  const passwordHash = db.prepare(`SELECT value FROM settings WHERE key = 'auth_password_hash'`).get();
  if (!username || !passwordHash) return null;

  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username.value, passwordHash.value);
  db.prepare(`DELETE FROM settings WHERE key IN ('auth_username', 'auth_password_hash')`).run();
  return result.lastInsertRowid;
}

// SQLite can't ALTER a UNIQUE constraint in place, so the old globally-
// unique service_types table is rebuilt with a per-user shape. Wrapped in a
// transaction so a mid-migration failure can't leave the table dropped
// without its replacement in place.
function migrateServiceTypesToPerUser(ownerId) {
  const rebuild = db.transaction(() => {
    db.exec(`
      CREATE TABLE service_types_new (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name    TEXT NOT NULL,
        UNIQUE(user_id, name)
      );
    `);
    if (ownerId != null) {
      db.prepare('INSERT INTO service_types_new (id, user_id, name) SELECT id, ?, name FROM service_types')
        .run(ownerId);
    }
    db.exec('DROP TABLE service_types');
    db.exec('ALTER TABLE service_types_new RENAME TO service_types');
  });
  rebuild();
}

// One-time upgrade from a single service_type column on service_records to
// a many-to-many join through service_record_types, so one record (one
// shop visit / one bill) can cover multiple service types instead of
// forcing a separate record per type. Guarded the same way as
// migrateToMultiUser above: a no-op once the old column is gone, and fresh
// installs never see it since schema.sql already creates the final shape.
// Runs after migrateToMultiUser so every vehicle's user_id is already
// resolved by the time this scopes service_types per owner.
function migrateServiceTypeToJunctionTable() {
  if (!hasColumn('service_records', 'service_type')) return;

  const run = db.transaction(() => {
    const records = db.prepare(`
      SELECT sr.id AS record_id, sr.service_type, v.user_id
      FROM service_records sr
      JOIN vehicles v ON v.id = sr.vehicle_id
    `).all();

    const ensureType = db.prepare('INSERT OR IGNORE INTO service_types (user_id, name) VALUES (?, ?)');
    const findTypeId = db.prepare('SELECT id FROM service_types WHERE user_id = ? AND name = ?');
    const linkType = db.prepare('INSERT OR IGNORE INTO service_record_types (service_record_id, service_type_id) VALUES (?, ?)');

    for (const r of records) {
      if (r.user_id == null) continue; // orphaned row with no owning user — nothing to scope a type to
      ensureType.run(r.user_id, r.service_type);
      const typeRow = findTypeId.get(r.user_id, r.service_type);
      linkType.run(r.record_id, typeRow.id);
    }

    db.exec('ALTER TABLE service_records DROP COLUMN service_type');
  });
  run();
}

module.exports = migrate;
