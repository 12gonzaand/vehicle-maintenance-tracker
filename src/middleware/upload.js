const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 15);

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

function safeFilename(originalname) {
  const rand = Math.round(Math.random() * 1e9);
  return `${Date.now()}-${rand}-${originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const vehicleId = req.params.vehicleId;
    const recordId = req.params.recordId;
    const dir = path.join(UPLOADS_DIR, 'vehicles', String(vehicleId), 'records', String(recordId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, safeFilename(file.originalname))
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, and PDF files are allowed'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 }
});

// Used when creating a new service record: the record (and its ID) doesn't
// exist yet when multer needs a destination, so files land here first and
// the route handler moves them into the record's folder once it has an ID.
const stagingDir = path.join(UPLOADS_DIR, 'tmp');

const stagedStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(stagingDir, { recursive: true });
    cb(null, stagingDir);
  },
  filename: (req, file, cb) => cb(null, safeFilename(file.originalname))
});

const uploadStaged = multer({
  storage: stagedStorage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 }
});

const vehiclePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const vehicleId = req.params.id;
    const dir = path.join(UPLOADS_DIR, 'vehicles', String(vehicleId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `photo${ext}`);
  }
});

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

const uploadVehiclePhoto = multer({
  storage: vehiclePhotoStorage,
  fileFilter: (req, file, cb) => {
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Only JPG and PNG images are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 }
});

module.exports = { upload, uploadStaged, uploadVehiclePhoto, UPLOADS_DIR };
