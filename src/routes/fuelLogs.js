const express = require('express');
const router = express.Router({ mergeParams: true });
const FuelLog = require('../models/fuelLog');
const Vehicle = require('../models/vehicle');

router.post('/', (req, res) => {
  const vehicleId = req.params.vehicleId;
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
  FuelLog.delete(req.params.logId);
  res.redirect(`/vehicles/${req.params.vehicleId}`);
});

module.exports = router;
