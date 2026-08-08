const db = require('../db');

const DEFAULT_TYPES = [
  'Oil Change',
  'Tire Rotation',
  'Brake Pads',
  'Brake Fluid',
  'Air Filter',
  'Cabin Air Filter',
  'Battery',
  'Coolant Flush',
  'Transmission Fluid',
  'Differential Service',
  'Spark Plugs',
  'Wiper Blades',
  'Alignment',
  'Registration',
  'Inspection',
  'Tire Replacement'
];

const ServiceType = {
  all(userId) {
    return db.prepare('SELECT * FROM service_types WHERE user_id = ? ORDER BY name ASC').all(userId);
  },

  ensure(userId, name) {
    db.prepare('INSERT OR IGNORE INTO service_types (user_id, name) VALUES (?, ?)').run(userId, name);
  },

  // Ensures every name exists for this user, then returns their ids (order
  // not guaranteed to match input order — callers only need the set).
  ensureAndGetIds(userId, names) {
    const ensure = db.prepare('INSERT OR IGNORE INTO service_types (user_id, name) VALUES (?, ?)');
    const findId = db.prepare('SELECT id FROM service_types WHERE user_id = ? AND name = ?');
    return names.map((name) => {
      ensure.run(userId, name);
      return findId.get(userId, name).id;
    });
  },

  seedDefaults(userId) {
    const insert = db.prepare('INSERT OR IGNORE INTO service_types (user_id, name) VALUES (?, ?)');
    const insertAll = db.transaction((types) => {
      for (const name of types) insert.run(userId, name);
    });
    insertAll(DEFAULT_TYPES);
  }
};

module.exports = ServiceType;
