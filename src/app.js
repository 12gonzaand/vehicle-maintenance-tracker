const path = require('path');
const express = require('express');
const methodOverride = require('method-override');

const vehiclesRouter = require('./routes/vehicles');
const serviceRecordsRouter = require('./routes/serviceRecords');
const mileageLogsRouter = require('./routes/mileageLogs');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(process.cwd(), process.env.UPLOADS_DIR || './uploads')));

app.get('/', (req, res) => res.redirect('/vehicles'));
app.use('/vehicles', vehiclesRouter);
app.use('/vehicles/:vehicleId/records', serviceRecordsRouter);
app.use('/vehicles/:vehicleId/mileage-logs', mileageLogsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(`Error: ${err.message}`);
});

module.exports = app;
