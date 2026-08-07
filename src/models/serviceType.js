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

  seedDefaults(userId) {
    const insert = db.prepare('INSERT OR IGNORE INTO service_types (user_id, name) VALUES (?, ?)');
    const insertAll = db.transaction((types) => {
      for (const name of types) insert.run(userId, name);
    });
    insertAll(DEFAULT_TYPES);
  }
};

module.exports = ServiceType;
