const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../db');

const ENV_LOCAL_PATH = path.join(__dirname, '..', '..', '.env.local');

function ensureSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

  const secret = crypto.randomBytes(32).toString('hex');
  fs.appendFileSync(ENV_LOCAL_PATH, `\nSESSION_SECRET=${secret}\n`);
  fs.chmodSync(ENV_LOCAL_PATH, 0o600);
  process.env.SESSION_SECRET = secret;
  return secret;
}

function getPasswordHash() {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'auth_password_hash'`).get();
  return row && row.value ? row.value : null;
}

function getUsername() {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'auth_username'`).get();
  return row && row.value ? row.value : null;
}

function isPasswordSet() {
  return Boolean(getPasswordHash());
}

function setUsername(username) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES ('auth_username', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(username.trim());
}

function setPassword(password) {
  const hash = bcrypt.hashSync(password, 12);
  db.prepare(`
    INSERT INTO settings (key, value) VALUES ('auth_password_hash', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(hash);
}

function verifyPassword(password) {
  const hash = getPasswordHash();
  if (!hash) return false;
  return bcrypt.compareSync(password, hash);
}

// Precomputed at startup so a bcrypt compare always runs below, even when the
// username is wrong or no password is set yet — otherwise a wrong username
// returns near-instantly while a wrong password takes ~100ms, letting an
// attacker fingerprint the valid username by timing responses.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

function verifyCredentials(username, password) {
  const storedUsername = getUsername();
  const hash = getPasswordHash() || DUMMY_HASH;
  const usernameOk = typeof username === 'string' && Boolean(storedUsername) && username.trim() === storedUsername;
  const passwordOk = typeof password === 'string' && bcrypt.compareSync(password, hash);
  return usernameOk && passwordOk;
}

// Per-IP login lockout: 5 failed attempts locks that IP out for 10 minutes.
// In-memory only (resets on restart) — fine for a handful of trusted
// Tailscale devices; this isn't meant to survive a determined attacker,
// just slow down casual password guessing.
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000;
const loginAttempts = new Map(); // ip -> { count, windowStart, lockedUntil }

function checkLockout(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || !entry.lockedUntil) return { locked: false };
  const remainingMs = entry.lockedUntil - Date.now();
  if (remainingMs <= 0) return { locked: false };
  return { locked: true, remainingMs };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  let entry = loginAttempts.get(ip);
  const windowExpired = entry && now - entry.windowStart > LOCKOUT_MS;
  const lockoutExpired = entry && entry.lockedUntil && entry.lockedUntil <= now;
  if (!entry || windowExpired || lockoutExpired) {
    entry = { count: 0, windowStart: now, lockedUntil: null };
  }
  entry.count += 1;
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  loginAttempts.set(ip, entry);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// Only allow redirecting back to a same-app relative path. Rejects
// protocol-relative ("//evil.com") and backslash ("/\evil.com") forms,
// which browsers treat as absolute URLs to another host.
function isSafeReturnTo(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (isSafeReturnTo(req.originalUrl)) req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

module.exports = {
  ensureSessionSecret, isPasswordSet, getUsername, setUsername, setPassword, verifyPassword,
  verifyCredentials, requireAuth, isSafeReturnTo, checkLockout, recordFailedLogin, clearLoginAttempts
};
