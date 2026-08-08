require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const migrate = require('./db/migrate');
const app = require('./app');

migrate();

const PORT = process.env.PORT || 3003;
const HOST = process.env.HOST || '0.0.0.0';

const certPath = path.join(__dirname, '..', 'certs', 'cert.pem');
const keyPath = path.join(__dirname, '..', 'certs', 'key.pem');

https
  .createServer(
    { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) },
    app
  )
  .listen(PORT, HOST, () => {
    console.log(`Maintenance tracker listening on https://${HOST}:${PORT}`);
  });

// Loopback-only plain HTTP listener for cloudflared (Cloudflare Tunnel
// terminates TLS at its edge; nothing outside this box can reach this one).
http.createServer(app).listen(PORT, '127.0.0.1', () => {
  console.log(`Maintenance tracker also listening on http://127.0.0.1:${PORT} (for cloudflared)`);
});
