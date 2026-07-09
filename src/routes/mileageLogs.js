const express = require('express');
const router = express.Router({ mergeParams: true });
const MileageLog = require('../models/mileageLog');
const Vehicle = require('../models/vehicle');

router.post('/', (req, res) => {
  const vehicleId = req.params.vehicleId;
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
  MileageLog.delete(req.params.logId);
  res.redirect(`/vehicles/${req.params.vehicleId}`);
});

module.exports = router;
