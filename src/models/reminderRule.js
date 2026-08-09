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

  // A record now covers a set of service types (see service_record_types),
  // so this matches any record that includes serviceType among them —
  // not only a record whose sole type happens to equal it.
  lastServiceFor(vehicleId, serviceType) {
    return db.prepare(`
      SELECT sr.* FROM service_records sr
      JOIN service_record_types srt ON srt.service_record_id = sr.id
      JOIN service_types st ON st.id = srt.service_type_id
      WHERE sr.vehicle_id = ? AND st.name = ?
      ORDER BY sr.service_date DESC, sr.mileage DESC
      LIMIT 1
    `).get(vehicleId, serviceType);
  },

  // Adds `months` to a YYYY-MM-DD date, clamped to the target month's
  // actual length so e.g. Jan 31 + 1 month lands on Feb 28, not March 3
  // (plain setMonth() overflows into the next month instead of clamping).
  // Uses UTC getters/setters throughout since service_date is a date-only
  // string, parsed as UTC midnight — mixing in local-time getters/setters
  // would make the result depend on the server's timezone.
  _addMonthsClamped(isoDate, months) {
    const date = new Date(isoDate);
    const day = date.getUTCDate();
    const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
    const daysInTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(day, daysInTargetMonth));
    return result;
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
        const base = this._addMonthsClamped(lastService.service_date, rule.interval_months);
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
