const express = require('express');
const router = express.Router({ mergeParams: true });
const FuelLog = require('../models/fuelLog');
const Vehicle = require('../models/vehicle');

router.param('logId', (req, res, next, logId) => {
  const log = FuelLog.find(logId);
  if (!log || log.vehicle_id !== req.vehicle.id) return res.status(404).send('Not found');
  req.log = log;
  next();
});

router.post('/', (req, res) => {
  const vehicleId = req.vehicle.id;
  const { fill_date, mileage, gallons, cost, fuel_grade } = req.body;
  const log = FuelLog.create(vehicleId, {
    fill_date,
    mileage: Number(mileage),
    gallons: Number(gallons),
    cost: cost ? Number(cost) : null,
    fuel_grade: fuel_grade || null
  });
  Vehicle.bumpMileageIfHigher(vehicleId, log.mileage);
  res.redirect(`/vehicles/${vehicleId}`);
});

router.post('/:logId/delete', (req, res) => {
  FuelLog.delete(req.log.id);
  res.redirect(`/vehicles/${req.vehicle.id}`);
});

module.exports = router;
