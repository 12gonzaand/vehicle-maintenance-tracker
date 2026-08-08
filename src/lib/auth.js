const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/user');

const ENV_LOCAL_PATH = path.join(__dirname, '..', '..', '.env.local');

function ensureSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

  const secret = crypto.randomBytes(32).toString('hex');
  fs.appendFileSync(ENV_LOCAL_PATH, `\nSESSION_SECRET=${secret}\n`);
  fs.chmodSync(ENV_LOCAL_PATH, 0o600);
  process.env.SESSION_SECRET = secret;
  return secret;
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

// Precomputed at startup so a bcrypt compare always runs below, even when the
// username doesn't match any account — otherwise a wrong username returns
// near-instantly while a wrong password takes ~100ms, letting an attacker
// fingerprint valid usernames by timing responses.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

function verifyCredentials(username, password) {
  const user = User.findByUsername(username);
  const hash = (user && user.password_hash) || DUMMY_HASH;
  const passwordOk = typeof password === 'string' && bcrypt.compareSync(password, hash);
  return user && passwordOk ? user : null;
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

// req.ip is 127.0.0.1 for every request that arrives via the loopback
// listener (cloudflared) — CF-Connecting-IP carries the real visitor IP for
// that path, set by Cloudflare's edge and not spoofable through the tunnel.
// Absent on the direct Tailscale path, where req.ip is already correct.
function clientIp(req) {
  return req.headers['cf-connecting-ip'] || req.ip;
}

// Only allow redirecting back to a same-app relative path. Rejects
// protocol-relative ("//evil.com") and backslash ("/\evil.com") forms,
// which browsers treat as absolute URLs to another host.
function isSafeReturnTo(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
}

function requireAuth(req, res, next) {
  const userId = req.session && req.session.userId;
  if (userId) {
    const user = User.find(userId);
    if (user) {
      req.user = user;
      res.locals.currentUser = user;
      return next();
    }
    // Session points at an account that no longer exists (e.g. deleted).
    return req.session.destroy(() => res.redirect('/login'));
  }
  if (isSafeReturnTo(req.originalUrl)) req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

module.exports = {
  ensureSessionSecret, hashPassword, verifyCredentials, requireAuth, isSafeReturnTo,
  checkLockout, recordFailedLogin, clearLoginAttempts, clientIp
};
