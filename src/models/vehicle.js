const db = require('../db');

const Vehicle = {
  all({ userId, includeArchived = false } = {}) {
    const query = includeArchived
      ? 'SELECT * FROM vehicles WHERE user_id = ? ORDER BY archived ASC, name ASC'
      : 'SELECT * FROM vehicles WHERE user_id = ? AND archived = 0 ORDER BY name ASC';
    return db.prepare(query).all(userId);
  },

  find(id) {
    return db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
  },

  create({ user_id, name, year, make, model, vin, current_mileage }) {
    const stmt = db.prepare(`
      INSERT INTO vehicles (user_id, name, year, make, model, vin, current_mileage)
      VALUES (@user_id, @name, @year, @make, @model, @vin, @current_mileage)
    `);
    const result = stmt.run({ user_id, name, year, make, model, vin, current_mileage });
    return this.find(result.lastInsertRowid);
  },

  update(id, { name, year, make, model, vin, current_mileage }) {
    db.prepare(`
      UPDATE vehicles
      SET name = @name, year = @year, make = @make, model = @model,
          vin = @vin, current_mileage = @current_mileage,
          updated_at = datetime('now')
      WHERE id = @id
    `).run({ id, name, year, make, model, vin, current_mileage });
    return this.find(id);
  },

  setPhoto(id, photoPath) {
    db.prepare(`UPDATE vehicles SET photo_path = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(photoPath, id);
  },

  setArchived(id, archived) {
    db.prepare(`UPDATE vehicles SET archived = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(archived ? 1 : 0, id);
  },

  delete(id) {
    db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
  },

  bumpMileageIfHigher(id, mileage) {
    if (mileage == null) return;
    db.prepare(`
      UPDATE vehicles
      SET current_mileage = ?, updated_at = datetime('now')
      WHERE id = ? AND (current_mileage IS NULL OR current_mileage < ?)
    `).run(mileage, id, mileage);
  }
};

module.exports = Vehicle;
