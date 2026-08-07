const express = require('express');
const router = express.Router({ mergeParams: true });
const MileageLog = require('../models/mileageLog');
const Vehicle = require('../models/vehicle');

router.param('logId', (req, res, next, logId) => {
  const log = MileageLog.find(logId);
  if (!log || log.vehicle_id !== req.vehicle.id) return res.status(404).send('Not found');
  req.log = log;
  next();
});

router.post('/', (req, res) => {
  const vehicleId = req.vehicle.id;
  const { mileage, log_date, note } = req.body;
  const log = MileageLog.create(vehicleId, {
    mileage: Number(mileage),
    log_date,
    note
  });
  Vehicle.bumpMileageIfHigher(vehicleId, log.mileage);
  res.redirect(`/vehicles/${vehicleId}`);
});

router.post('/:logId/delete', (req, res) => {
  MileageLog.delete(req.log.id);
  res.redirect(`/vehicles/${req.vehicle.id}`);
});

module.exports = router;
