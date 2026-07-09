require('dotenv').config();
const migrate = require('./db/migrate');
const app = require('./app');

migrate();

const PORT = process.env.PORT || 3003;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Maintenance tracker listening on http://${HOST}:${PORT}`);
});
