const db = require('../db');

const FuelLog = {
  allForVehicle(vehicleId) {
    const rows = db.prepare(
      'SELECT * FROM fuel_logs WHERE vehicle_id = ? ORDER BY mileage ASC, fill_date ASC'
    ).all(vehicleId);

    let prevMileage = null;
    for (const row of rows) {
      row.mpg = (prevMileage != null && row.gallons > 0)
        ? (row.mileage - prevMileage) / row.gallons
        : null;
      prevMileage = row.mileage;
    }
    return rows;
  },

  find(id) {
    return db.prepare('SELECT * FROM fuel_logs WHERE id = ?').get(id);
  },

  create(vehicleId, { fill_date, mileage, gallons, cost, fuel_grade }) {
    const stmt = db.prepare(`
      INSERT INTO fuel_logs (vehicle_id, fill_date, mileage, gallons, cost, fuel_grade)
      VALUES (@vehicle_id, @fill_date, @mileage, @gallons, @cost, @fuel_grade)
    `);
    const result = stmt.run({ vehicle_id: vehicleId, fill_date, mileage, gallons, cost, fuel_grade });
    return this.find(result.lastInsertRowid);
  },

  delete(id) {
    db.prepare('DELETE FROM fuel_logs WHERE id = ?').run(id);
  }
};

module.exports = FuelLog;
