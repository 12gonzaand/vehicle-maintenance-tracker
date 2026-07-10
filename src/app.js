const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');

const authRouter = require('./routes/auth');
const vehiclesRouter = require('./routes/vehicles');
const serviceRecordsRouter = require('./routes/serviceRecords');
const mileageLogsRouter = require('./routes/mileageLogs');
const requireAuth = require('./middleware/requireAuth');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

app.use(authRouter);

app.use('/uploads', requireAuth, express.static(path.join(process.cwd(), process.env.UPLOADS_DIR || './uploads')));

app.get('/', (req, res) => res.redirect('/vehicles'));
app.use('/vehicles', requireAuth, vehiclesRouter);
app.use('/vehicles/:vehicleId/records', requireAuth, serviceRecordsRouter);
app.use('/vehicles/:vehicleId/mileage-logs', requireAuth, mileageLogsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(`Error: ${err.message}`);
});

module.exports = app;
