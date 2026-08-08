const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 15);

// The extension a stored file gets is derived from this map, never from the
// client-supplied original filename — a request can claim any Content-Type
// alongside any filename it wants, so trusting the filename's extension
// would let an "image/jpeg" upload land on disk as e.g. "x.html" and get
// served back as text/html later. Keying storage off the (fileFilter-
// validated) mimetype instead means the on-disk extension always matches
// what was actually allowed through.
const EXTENSION_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf'
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(EXTENSION_BY_MIME));

// Called from a storage `filename` callback, which multer only invokes after
// fileFilter has already accepted the file — so `mimetype` is guaranteed to
// be a key in EXTENSION_BY_MIME here.
function safeFilename(originalname, mimetype) {
  const rand = Math.round(Math.random() * 1e9);
  const base = path.basename(originalname, path.extname(originalname)).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${Date.now()}-${rand}-${base}${EXTENSION_BY_MIME[mimetype] || ''}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const vehicleId = req.params.vehicleId;
    const recordId = req.params.recordId;
    const dir = path.join(UPLOADS_DIR, 'vehicles', String(vehicleId), 'records', String(recordId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, safeFilename(file.originalname, file.mimetype))
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
  filename: (req, file, cb) => cb(null, safeFilename(file.originalname, file.mimetype))
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
  filename: (req, file, cb) => cb(null, `photo${EXTENSION_BY_MIME[file.mimetype] || ''}`)
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

// Used only for the receipt-scan endpoint (src/routes/receiptScan.js) — the
// image is sent to Gemini and never written to disk, so this uses in-memory
// storage rather than the diskStorage instances above.
const uploadReceiptScan = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Only JPG and PNG images are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 }
});

module.exports = {
  upload, uploadStaged, uploadVehiclePhoto, uploadReceiptScan, UPLOADS_DIR, EXTENSION_BY_MIME
};
