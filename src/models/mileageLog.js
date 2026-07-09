const db = require('../db');

const MileageLog = {
  allForVehicle(vehicleId) {
    return db.prepare('SELECT * FROM mileage_logs WHERE vehicle_id = ? ORDER BY log_date ASC').all(vehicleId);
  },

  find(id) {
    return db.prepare('SELECT * FROM mileage_logs WHERE id = ?').get(id);
  },

  create(vehicleId, { mileage, log_date, note }) {
    const stmt = db.prepare(`
      INSERT INTO mileage_logs (vehicle_id, mileage, log_date, note)
      VALUES (@vehicle_id, @mileage, @log_date, @note)
    `);
    const result = stmt.run({ vehicle_id: vehicleId, mileage, log_date, note });
    return this.find(result.lastInsertRowid);
  },

  delete(id) {
    db.prepare('DELETE FROM mileage_logs WHERE id = ?').run(id);
  },

  combinedHistory(vehicleId) {
    return db.prepare(`
      SELECT log_date AS date, mileage, 'log' AS source, note AS label
      FROM mileage_logs WHERE vehicle_id = ?
      UNION ALL
      SELECT service_date AS date, mileage, 'service' AS source, service_type AS label
      FROM service_records WHERE vehicle_id = ? AND mileage IS NOT NULL
      ORDER BY date ASC
    `).all(vehicleId, vehicleId);
  }
};

module.exports = MileageLog;
