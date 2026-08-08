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
      SELECT sr.service_date AS date, sr.mileage, 'service' AS source,
        (SELECT GROUP_CONCAT(name, ', ') FROM (
          SELECT st.name FROM service_record_types srt
          JOIN service_types st ON st.id = srt.service_type_id
          WHERE srt.service_record_id = sr.id
          ORDER BY st.name
        )) AS label
      FROM service_records sr WHERE sr.vehicle_id = ? AND sr.mileage IS NOT NULL
      ORDER BY date ASC
    `).all(vehicleId, vehicleId);
  }
};

module.exports = MileageLog;
