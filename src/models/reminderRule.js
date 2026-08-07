const db = require('../db');

const ReminderRule = {
  allForVehicle(vehicleId) {
    return db.prepare('SELECT * FROM reminder_rules WHERE vehicle_id = ? ORDER BY service_type ASC').all(vehicleId);
  },

  find(id) {
    return db.prepare('SELECT * FROM reminder_rules WHERE id = ?').get(id);
  },

  create(vehicleId, { service_type, interval_miles, interval_months }) {
    const stmt = db.prepare(`
      INSERT INTO reminder_rules (vehicle_id, service_type, interval_miles, interval_months)
      VALUES (@vehicle_id, @service_type, @interval_miles, @interval_months)
    `);
    const result = stmt.run({
      vehicle_id: vehicleId,
      service_type,
      interval_miles: interval_miles || null,
      interval_months: interval_months || null
    });
    return this.find(result.lastInsertRowid);
  },

  delete(id) {
    db.prepare('DELETE FROM reminder_rules WHERE id = ?').run(id);
  },

  lastServiceFor(vehicleId, serviceType) {
    return db.prepare(`
      SELECT * FROM service_records
      WHERE vehicle_id = ? AND service_type = ?
      ORDER BY service_date DESC, mileage DESC
      LIMIT 1
    `).get(vehicleId, serviceType);
  },

  // Computes due/overdue status for every rule on a vehicle, against that
  // vehicle's current mileage and the most recent matching service record.
  statusForVehicle(vehicle) {
    const today = new Date();
    const statuses = this.allForVehicle(vehicle.id).map((rule) => {
      const lastService = this.lastServiceFor(vehicle.id, rule.service_type);

      let milesRemaining = null;
      if (rule.interval_miles != null && lastService && lastService.mileage != null && vehicle.current_mileage != null) {
        milesRemaining = (lastService.mileage + rule.interval_miles) - vehicle.current_mileage;
      }

      let dueDate = null;
      let daysRemaining = null;
      if (rule.interval_months != null && lastService) {
        const base = new Date(lastService.service_date);
        base.setMonth(base.getMonth() + rule.interval_months);
        dueDate = base.toISOString().slice(0, 10);
        daysRemaining = Math.round((base - today) / (1000 * 60 * 60 * 24));
      }

      const overdue = (milesRemaining != null && milesRemaining <= 0) || (daysRemaining != null && daysRemaining <= 0);
      const dueSoon = !overdue && (
        (milesRemaining != null && milesRemaining <= 500) ||
        (daysRemaining != null && daysRemaining <= 30)
      );

      return { rule, lastService, milesRemaining, dueDate, daysRemaining, overdue, dueSoon };
    });

    // Most urgent first: overdue, then due soon, then everything else.
    return statuses.sort((a, b) => (b.overdue - a.overdue) || (b.dueSoon - a.dueSoon));
  }
};

module.exports = ReminderRule;
