const db = require('../db');

const SORT_COLUMNS = new Set(['service_date', 'mileage', 'service_type']);

// Alphabetized, comma-joined list of this record's service type names —
// wrapped as a derived table (rather than GROUP_CONCAT directly over the
// join) so the ORDER BY inside it reliably controls concatenation order.
const TYPE_NAMES_SUBQUERY = `(
  SELECT GROUP_CONCAT(name, ', ') FROM (
    SELECT st.name FROM service_record_types srt
    JOIN service_types st ON st.id = srt.service_type_id
    WHERE srt.service_record_id = sr.id
    ORDER BY st.name
  )
)`;

const ServiceRecord = {
  allForVehicle(vehicleId, { sortBy = 'service_date', order = 'DESC', serviceType } = {}) {
    // 'service_type' sorts by the aggregated type_names alias below — kept
    // as a separate case (not just added to SORT_COLUMNS) since it isn't a
    // real column on service_records, it's the computed alias.
    const column = sortBy === 'service_type'
      ? 'type_names'
      : (SORT_COLUMNS.has(sortBy) ? sortBy : 'service_date');
    const direction = order === 'ASC' ? 'ASC' : 'DESC';

    let query = `
      SELECT sr.*, ${TYPE_NAMES_SUBQUERY} AS type_names
      FROM service_records sr
      WHERE sr.vehicle_id = ?
    `;
    const params = [vehicleId];
    if (serviceType) {
      query += `
        AND EXISTS (
          SELECT 1 FROM service_record_types srt
          JOIN service_types st ON st.id = srt.service_type_id
          WHERE srt.service_record_id = sr.id AND st.name = ?
        )
      `;
      params.push(serviceType);
    }
    query += ` ORDER BY ${column} ${direction}`;
    return db.prepare(query).all(...params);
  },

  find(id) {
    const record = db.prepare('SELECT * FROM service_records WHERE id = ?').get(id);
    if (!record) return record;
    const serviceTypes = db.prepare(`
      SELECT st.name FROM service_record_types srt
      JOIN service_types st ON st.id = srt.service_type_id
      WHERE srt.service_record_id = ?
      ORDER BY st.name
    `).all(id).map((r) => r.name);
    return { ...record, serviceTypes };
  },

  // service_type_ids: already-resolved service_types.id values (see
  // ServiceType.ensureAndGetIds) — resolving names to ids needs a userId,
  // which this model otherwise never touches, so that step stays in the
  // route layer, same separation the rest of this model already has.
  create(vehicleId, { service_type_ids, service_date, mileage, cost, notes, shop }) {
    const insertRecord = db.prepare(`
      INSERT INTO service_records (vehicle_id, service_date, mileage, cost, notes, shop)
      VALUES (@vehicle_id, @service_date, @mileage, @cost, @notes, @shop)
    `);
    const linkType = db.prepare('INSERT INTO service_record_types (service_record_id, service_type_id) VALUES (?, ?)');

    const insertId = db.transaction(() => {
      const result = insertRecord.run({ vehicle_id: vehicleId, service_date, mileage, cost, notes, shop });
      for (const typeId of service_type_ids) linkType.run(result.lastInsertRowid, typeId);
      return result.lastInsertRowid;
    })();

    return this.find(insertId);
  },

  update(id, { service_type_ids, service_date, mileage, cost, notes, shop }) {
    const updateRecord = db.prepare(`
      UPDATE service_records
      SET service_date = @service_date, mileage = @mileage, cost = @cost, notes = @notes, shop = @shop,
          updated_at = datetime('now')
      WHERE id = @id
    `);
    const clearTypes = db.prepare('DELETE FROM service_record_types WHERE service_record_id = ?');
    const linkType = db.prepare('INSERT INTO service_record_types (service_record_id, service_type_id) VALUES (?, ?)');

    db.transaction(() => {
      updateRecord.run({ id, service_date, mileage, cost, notes, shop });
      clearTypes.run(id);
      for (const typeId of service_type_ids) linkType.run(id, typeId);
    })();

    return this.find(id);
  },

  delete(id) {
    db.prepare('DELETE FROM service_records WHERE id = ?').run(id);
  }
};

module.exports = ServiceRecord;
module.exports.TYPE_NAMES_SUBQUERY = TYPE_NAMES_SUBQUERY;
