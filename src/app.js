const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');

const authRouter = require('./routes/auth');
const vehiclesRouter = require('./routes/vehicles');
const serviceRecordsRouter = require('./routes/serviceRecords');
const mileageLogsRouter = require('./routes/mileageLogs');
const fuelLogsRouter = require('./routes/fuelLogs');
const reminderRulesRouter = require('./routes/reminderRules');
const receiptScanRouter = require('./routes/receiptScan');
const { ensureSessionSecret, requireAuth } = require('./lib/auth');
const { loadOwnedVehicle } = require('./middleware/ownership');
const { UPLOADS_DIR } = require('./middleware/upload');
const ServiceRecord = require('./models/serviceRecord');
const ServiceFile = require('./models/serviceFile');
const User = require('./models/user');

// New uploads always get .jpg/.png/.pdf (see middleware/upload.js), but
// vehicle photos uploaded before that normalization existed may still be on
// disk as .jpeg — accept both so this lookup doesn't 404 pre-existing files.
const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf'
};

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Only trust X-Forwarded-* headers from a proxy connecting via loopback —
// that's cloudflared (Cloudflare Tunnel), forwarding the public hostname to
// the plain-HTTP listener in server.js. Direct Tailscale connections arrive
// from remote peer IPs, never loopback, so this doesn't affect that path.
app.set('trust proxy', 'loopback');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(session({
  secret: ensureSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 }
}));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

app.use(authRouter);

// Files are served through explicit, ownership-checked routes rather than a
// blanket express.static mount — the filesystem path to serve always comes
// from a DB row already scoped to a vehicle the caller owns, never directly
// from the URL, so there's no path-traversal surface either.
const uploadsRoot = path.join(process.cwd(), UPLOADS_DIR);

// Content-Type is pinned explicitly from a trusted source (never inferred
// from the on-disk filename by res.sendFile/send) — that's what the upload
// side's fixed extension-by-mimetype mapping (middleware/upload.js) makes
// possible, since the extension can no longer be attacker-chosen. nosniff
// stops a browser from second-guessing that with its own content sniffing.
app.get('/uploads/vehicles/:vehicleId/:filename', requireAuth, loadOwnedVehicle, (req, res) => {
  if (!req.vehicle.photo_path || path.basename(req.vehicle.photo_path) !== req.params.filename) {
    return res.status(404).end();
  }
  const mimeType = MIME_BY_EXTENSION[path.extname(req.vehicle.photo_path).toLowerCase()];
  if (!mimeType) return res.status(404).end();
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type(mimeType);
  res.sendFile(path.join(uploadsRoot, req.vehicle.photo_path));
});
app.get('/uploads/vehicles/:vehicleId/records/:recordId/:filename', requireAuth, loadOwnedVehicle, (req, res) => {
  const record = ServiceRecord.find(req.params.recordId);
  if (!record || record.vehicle_id !== req.vehicle.id) return res.status(404).end();
  const file = ServiceFile.allForRecord(record.id).find((f) => path.basename(f.stored_path) === req.params.filename);
  if (!file) return res.status(404).end();
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type(file.mime_type);
  res.sendFile(path.join(uploadsRoot, file.stored_path));
});

app.get('/', (req, res) => res.redirect('/vehicles'));
app.get('/settings', requireAuth, (req, res) => res.render('settings'));
app.post('/settings/display-name', requireAuth, (req, res) => {
  const displayName = (req.body.display_name || '').trim().slice(0, 40);
  User.updateDisplayName(req.user.id, displayName);
  res.redirect('/settings');
});
app.use('/vehicles', requireAuth, vehiclesRouter);
app.use('/vehicles/:vehicleId/records', requireAuth, loadOwnedVehicle, serviceRecordsRouter);
app.use('/vehicles/:vehicleId/mileage-logs', requireAuth, loadOwnedVehicle, mileageLogsRouter);
app.use('/vehicles/:vehicleId/fuel-logs', requireAuth, loadOwnedVehicle, fuelLogsRouter);
app.use('/vehicles/:vehicleId/reminder-rules', requireAuth, loadOwnedVehicle, reminderRulesRouter);
app.use('/vehicles/:vehicleId/receipt-scan', requireAuth, loadOwnedVehicle, receiptScanRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(`Error: ${err.message}`);
});

module.exports = app;
