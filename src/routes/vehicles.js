const express = require('express');
const router = express.Router();
const Vehicle = require('../models/vehicle');
const ServiceRecord = require('../models/serviceRecord');
const MileageLog = require('../models/mileageLog');
const FuelLog = require('../models/fuelLog');
const ServiceType = require('../models/serviceType');
const ReminderRule = require('../models/reminderRule');
const { uploadVehiclePhoto } = require('../middleware/upload');

router.param('id', (req, res, next, id) => {
  const vehicle = Vehicle.find(id);
  if (!vehicle || vehicle.user_id !== req.user.id) return res.status(404).send('Vehicle not found');
  req.vehicle = vehicle;
  next();
});

router.get('/', (req, res) => {
  const showArchived = req.query.archived === '1';
  const vehicles = Vehicle.all({ userId: req.user.id, includeArchived: showArchived });
  res.render('vehicles/list', { vehicles, showArchived });
});

router.get('/new', (req, res) => {
  res.render('vehicles/form', { vehicle: null });
});

router.post('/', (req, res) => {
  const { name, year, make, model, vin, current_mileage } = req.body;
  const vehicle = Vehicle.create({
    user_id: req.user.id,
    name,
    year: year ? Number(year) : null,
    make,
    model,
    vin,
    current_mileage: current_mileage ? Number(current_mileage) : null
  });
  res.redirect(`/vehicles/${vehicle.id}`);
});

router.get('/:id', (req, res) => {
  const vehicle = req.vehicle;

  const { sortBy, order, serviceType } = req.query;
  const records = ServiceRecord.allForVehicle(vehicle.id, { sortBy, order, serviceType });
  const mileageHistory = MileageLog.combinedHistory(vehicle.id);
  const fuelLogs = FuelLog.allForVehicle(vehicle.id);
  const serviceTypes = ServiceType.all(req.user.id);
  const reminders = ReminderRule.statusForVehicle(vehicle);

  res.render('vehicles/detail', {
    vehicle,
    records,
    mileageHistory,
    fuelLogs,
    serviceTypes,
    reminders,
    query: req.query
  });
});

router.get('/:id/edit', (req, res) => {
  res.render('vehicles/form', { vehicle: req.vehicle });
});

router.post('/:id', (req, res) => {
  const { name, year, make, model, vin, current_mileage } = req.body;
  Vehicle.update(req.params.id, {
    name,
    year: year ? Number(year) : null,
    make,
    model,
    vin,
    current_mileage: current_mileage ? Number(current_mileage) : null
  });
  res.redirect(`/vehicles/${req.params.id}`);
});

router.post('/:id/photo', uploadVehiclePhoto.single('photo'), (req, res) => {
  if (req.file) {
    const relativePath = `vehicles/${req.params.id}/${req.file.filename}`;
    Vehicle.setPhoto(req.params.id, relativePath);
  }
  res.redirect(`/vehicles/${req.params.id}`);
});

router.post('/:id/archive', (req, res) => {
  Vehicle.setArchived(req.params.id, true);
  res.redirect('/vehicles');
});

router.post('/:id/unarchive', (req, res) => {
  Vehicle.setArchived(req.params.id, false);
  res.redirect('/vehicles');
});

router.post('/:id/delete', (req, res) => {
  Vehicle.delete(req.params.id);
  res.redirect('/vehicles');
});

module.exports = router;
