const db = require('../db');

const SORT_COLUMNS = new Set(['service_date', 'mileage', 'service_type']);

const ServiceRecord = {
  allForVehicle(vehicleId, { sortBy = 'service_date', order = 'DESC', serviceType } = {}) {
    const column = SORT_COLUMNS.has(sortBy) ? sortBy : 'service_date';
    const direction = order === 'ASC' ? 'ASC' : 'DESC';
    let query = 'SELECT * FROM service_records WHERE vehicle_id = ?';
    const params = [vehicleId];
    if (serviceType) {
      query += ' AND service_type = ?';
      params.push(serviceType);
    }
    query += ` ORDER BY ${column} ${direction}`;
    return db.prepare(query).all(...params);
  },

  find(id) {
    return db.prepare('SELECT * FROM service_records WHERE id = ?').get(id);
  },

  create(vehicleId, { service_type, service_date, mileage, cost, notes, shop }) {
    const stmt = db.prepare(`
      INSERT INTO service_records (vehicle_id, service_type, service_date, mileage, cost, notes, shop)
      VALUES (@vehicle_id, @service_type, @service_date, @mileage, @cost, @notes, @shop)
    `);
    const result = stmt.run({ vehicle_id: vehicleId, service_type, service_date, mileage, cost, notes, shop });
    return this.find(result.lastInsertRowid);
  },

  update(id, { service_type, service_date, mileage, cost, notes, shop }) {
    db.prepare(`
      UPDATE service_records
      SET service_type = @service_type, service_date = @service_date, mileage = @mileage,
          cost = @cost, notes = @notes, shop = @shop, updated_at = datetime('now')
      WHERE id = @id
    `).run({ id, service_type, service_date, mileage, cost, notes, shop });
    return this.find(id);
  },

  delete(id) {
    db.prepare('DELETE FROM service_records WHERE id = ?').run(id);
  }
};

module.exports = ServiceRecord;
