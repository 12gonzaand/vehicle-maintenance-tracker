const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');

const authRouter = require('./routes/auth');
const vehiclesRouter = require('./routes/vehicles');
const serviceRecordsRouter = require('./routes/serviceRecords');
const mileageLogsRouter = require('./routes/mileageLogs');
const fuelLogsRouter = require('./routes/fuelLogs');
const { ensureSessionSecret, requireAuth } = require('./lib/auth');
const { loadOwnedVehicle } = require('./middleware/ownership');
const { UPLOADS_DIR } = require('./middleware/upload');
const ServiceRecord = require('./models/serviceRecord');
const ServiceFile = require('./models/serviceFile');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(session({
  secret: ensureSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 }
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

app.get('/uploads/vehicles/:vehicleId/:filename', requireAuth, loadOwnedVehicle, (req, res) => {
  if (!req.vehicle.photo_path || path.basename(req.vehicle.photo_path) !== req.params.filename) {
    return res.status(404).end();
  }
  res.sendFile(path.join(uploadsRoot, req.vehicle.photo_path));
});
app.get('/uploads/vehicles/:vehicleId/records/:recordId/:filename', requireAuth, loadOwnedVehicle, (req, res) => {
  const record = ServiceRecord.find(req.params.recordId);
  if (!record || record.vehicle_id !== req.vehicle.id) return res.status(404).end();
  const file = ServiceFile.allForRecord(record.id).find((f) => path.basename(f.stored_path) === req.params.filename);
  if (!file) return res.status(404).end();
  res.sendFile(path.join(uploadsRoot, file.stored_path));
});

app.get('/', (req, res) => res.redirect('/vehicles'));
app.get('/settings', requireAuth, (req, res) => res.render('settings'));
app.use('/vehicles', requireAuth, vehiclesRouter);
app.use('/vehicles/:vehicleId/records', requireAuth, loadOwnedVehicle, serviceRecordsRouter);
app.use('/vehicles/:vehicleId/mileage-logs', requireAuth, loadOwnedVehicle, mileageLogsRouter);
app.use('/vehicles/:vehicleId/fuel-logs', requireAuth, loadOwnedVehicle, fuelLogsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(`Error: ${err.message}`);
});

module.exports = app;
