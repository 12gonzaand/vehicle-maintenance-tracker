const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const fs = require('fs');
const ServiceRecord = require('../models/serviceRecord');
const ServiceFile = require('../models/serviceFile');
const ServiceType = require('../models/serviceType');
const Vehicle = require('../models/vehicle');
const { upload, uploadStaged, UPLOADS_DIR } = require('../middleware/upload');

// req.vehicle is already set by the app.js-level loadOwnedVehicle middleware
// (vehicleId isn't declared in this router's own paths, only merged in from
// the parent mount, so router.param('vehicleId', ...) here would never fire).
router.param('recordId', (req, res, next, recordId) => {
  const record = ServiceRecord.find(recordId);
  if (!record || record.vehicle_id !== req.vehicle.id) return res.status(404).send('Not found');
  req.record = record;
  next();
});

router.param('fileId', (req, res, next, fileId) => {
  const file = ServiceFile.find(fileId);
  if (!file || file.service_record_id !== req.record.id) return res.status(404).send('Not found');
  req.file_ = file;
  next();
});

router.get('/new', (req, res) => {
  res.render('serviceRecords/form', { vehicle: req.vehicle, record: null, serviceTypes: ServiceType.all(req.user.id) });
});

router.post('/', uploadStaged.array('files'), (req, res) => {
  const vehicleId = req.vehicle.id;
  const { service_type, service_date, mileage, cost, notes, shop } = req.body;

  ServiceType.ensure(req.user.id, service_type);

  const record = ServiceRecord.create(vehicleId, {
    service_type,
    service_date,
    mileage: mileage ? Number(mileage) : null,
    cost: cost ? Number(cost) : null,
    notes,
    shop
  });

  Vehicle.bumpMileageIfHigher(vehicleId, record.mileage);

  if (req.files && req.files.length > 0) {
    const recordDir = path.join(UPLOADS_DIR, 'vehicles', String(vehicleId), 'records', String(record.id));
    fs.mkdirSync(recordDir, { recursive: true });
    for (const file of req.files) {
      const storedRelPath = `vehicles/${vehicleId}/records/${record.id}/${file.filename}`;
      fs.renameSync(file.path, path.join(UPLOADS_DIR, storedRelPath));
      ServiceFile.create(record.id, {
        original_filename: file.originalname,
        stored_path: storedRelPath,
        mime_type: file.mimetype,
        size_bytes: file.size
      });
    }
  }

  res.redirect(`/vehicles/${vehicleId}/records/${record.id}`);
});

router.get('/:recordId', (req, res) => {
  const files = ServiceFile.allForRecord(req.record.id);
  res.render('serviceRecords/detail', { vehicle: req.vehicle, record: req.record, files });
});

router.get('/:recordId/edit', (req, res) => {
  res.render('serviceRecords/form', { vehicle: req.vehicle, record: req.record, serviceTypes: ServiceType.all(req.user.id) });
});

router.post('/:recordId', (req, res) => {
  const vehicleId = req.vehicle.id;
  const { service_type, service_date, mileage, cost, notes, shop } = req.body;

  ServiceType.ensure(req.user.id, service_type);

  const record = ServiceRecord.update(req.record.id, {
    service_type,
    service_date,
    mileage: mileage ? Number(mileage) : null,
    cost: cost ? Number(cost) : null,
    notes,
    shop
  });

  Vehicle.bumpMileageIfHigher(vehicleId, record.mileage);
  res.redirect(`/vehicles/${vehicleId}/records/${record.id}`);
});

router.post('/:recordId/delete', (req, res) => {
  const vehicleId = req.vehicle.id;
  const recordDir = path.join(UPLOADS_DIR, 'vehicles', String(vehicleId), 'records', String(req.record.id));
  fs.rm(recordDir, { recursive: true, force: true }, () => {});
  ServiceRecord.delete(req.record.id);
  res.redirect(`/vehicles/${vehicleId}`);
});

router.post('/:recordId/files', upload.array('files'), (req, res) => {
  const vehicleId = req.vehicle.id;
  const recordId = req.record.id;
  for (const file of req.files || []) {
    ServiceFile.create(recordId, {
      original_filename: file.originalname,
      stored_path: `vehicles/${vehicleId}/records/${recordId}/${file.filename}`,
      mime_type: file.mimetype,
      size_bytes: file.size
    });
  }
  res.redirect(`/vehicles/${vehicleId}/records/${recordId}`);
});

router.post('/:recordId/files/:fileId/delete', (req, res) => {
  fs.rm(path.join(UPLOADS_DIR, req.file_.stored_path), { force: true }, () => {});
  ServiceFile.delete(req.file_.id);
  res.redirect(`/vehicles/${req.vehicle.id}/records/${req.record.id}`);
});

module.exports = router;
