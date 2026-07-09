const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const fs = require('fs');
const ServiceRecord = require('../models/serviceRecord');
const ServiceFile = require('../models/serviceFile');
const ServiceType = require('../models/serviceType');
const Vehicle = require('../models/vehicle');
const { upload, uploadStaged, UPLOADS_DIR } = require('../middleware/upload');

router.get('/new', (req, res) => {
  const vehicle = Vehicle.find(req.params.vehicleId);
  if (!vehicle) return res.status(404).send('Vehicle not found');
  res.render('serviceRecords/form', { vehicle, record: null, serviceTypes: ServiceType.all() });
});

router.post('/', uploadStaged.array('files'), (req, res) => {
  const vehicleId = req.params.vehicleId;
  const { service_type, service_date, mileage, cost, notes, shop } = req.body;

  ServiceType.ensure(service_type);

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
  const vehicle = Vehicle.find(req.params.vehicleId);
  const record = ServiceRecord.find(req.params.recordId);
  if (!vehicle || !record) return res.status(404).send('Not found');
  const files = ServiceFile.allForRecord(record.id);
  res.render('serviceRecords/detail', { vehicle, record, files });
});

router.get('/:recordId/edit', (req, res) => {
  const vehicle = Vehicle.find(req.params.vehicleId);
  const record = ServiceRecord.find(req.params.recordId);
  if (!vehicle || !record) return res.status(404).send('Not found');
  res.render('serviceRecords/form', { vehicle, record, serviceTypes: ServiceType.all() });
});

router.post('/:recordId', (req, res) => {
  const vehicleId = req.params.vehicleId;
  const { service_type, service_date, mileage, cost, notes, shop } = req.body;

  ServiceType.ensure(service_type);

  const record = ServiceRecord.update(req.params.recordId, {
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
  const vehicleId = req.params.vehicleId;
  const recordDir = path.join(UPLOADS_DIR, 'vehicles', String(vehicleId), 'records', String(req.params.recordId));
  fs.rm(recordDir, { recursive: true, force: true }, () => {});
  ServiceRecord.delete(req.params.recordId);
  res.redirect(`/vehicles/${vehicleId}`);
});

router.post('/:recordId/files', upload.array('files'), (req, res) => {
  const vehicleId = req.params.vehicleId;
  const recordId = req.params.recordId;
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
  const file = ServiceFile.find(req.params.fileId);
  if (file) {
    fs.rm(path.join(UPLOADS_DIR, file.stored_path), { force: true }, () => {});
    ServiceFile.delete(file.id);
  }
  res.redirect(`/vehicles/${req.params.vehicleId}/records/${req.params.recordId}`);
});

module.exports = router;
