const Vehicle = require('../models/vehicle');

function loadOwnedVehicle(req, res, next) {
  const vehicle = Vehicle.find(req.params.vehicleId);
  if (!vehicle || vehicle.user_id !== req.user.id) return res.status(404).send('Vehicle not found');
  req.vehicle = vehicle;
  next();
}

module.exports = { loadOwnedVehicle };
