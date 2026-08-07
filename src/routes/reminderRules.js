const express = require('express');
const router = express.Router({ mergeParams: true });
const ReminderRule = require('../models/reminderRule');

router.param('ruleId', (req, res, next, ruleId) => {
  const rule = ReminderRule.find(ruleId);
  if (!rule || rule.vehicle_id !== req.vehicle.id) return res.status(404).send('Not found');
  req.reminderRule = rule;
  next();
});

router.post('/', (req, res) => {
  const { service_type, interval_miles, interval_months } = req.body;
  ReminderRule.create(req.vehicle.id, {
    service_type,
    interval_miles: interval_miles ? Number(interval_miles) : null,
    interval_months: interval_months ? Number(interval_months) : null
  });
  res.redirect(`/vehicles/${req.vehicle.id}`);
});

router.post('/:ruleId/delete', (req, res) => {
  ReminderRule.delete(req.reminderRule.id);
  res.redirect(`/vehicles/${req.vehicle.id}`);
});

module.exports = router;
