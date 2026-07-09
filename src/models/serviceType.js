const db = require('../db');

const ServiceType = {
  all() {
    return db.prepare('SELECT * FROM service_types ORDER BY name ASC').all();
  },

  ensure(name) {
    db.prepare('INSERT OR IGNORE INTO service_types (name) VALUES (?)').run(name);
  }
};

module.exports = ServiceType;
