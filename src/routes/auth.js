const express = require('express');
const {
  isPasswordSet, setUsername, setPassword, verifyCredentials, isSafeReturnTo,
  checkLockout, recordFailedLogin, clearLoginAttempts
} = require('../lib/auth');

const router = express.Router();

function lockoutMessage(remainingMs) {
  const minutes = Math.ceil(remainingMs / 60000);
  return `Too many incorrect attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

router.get('/login/setup', (req, res) => {
  if (isPasswordSet()) return res.redirect('/login');
  res.render('auth/setup', { title: 'Set Up Password', error: null });
});

router.post('/login/setup', (req, res) => {
  if (isPasswordSet()) return res.redirect('/login');

  const { username, password, confirm_password } = req.body;
  if (!username || !username.trim()) {
    return res.render('auth/setup', { title: 'Set Up Password', error: 'Username is required.' });
  }
  if (!password || password.length < 8) {
    return res.render('auth/setup', { title: 'Set Up Password', error: 'Password must be at least 8 characters.' });
  }
  if (password !== confirm_password) {
    return res.render('auth/setup', { title: 'Set Up Password', error: 'Passwords do not match.' });
  }

  setUsername(username);
  setPassword(password);
  req.session.regenerate((err) => {
    if (err) return res.render('auth/setup', { title: 'Set Up Password', error: 'Something went wrong. Try again.' });
    req.session.authenticated = true;
    res.redirect('/vehicles');
  });
});

router.get('/login', (req, res) => {
  if (!isPasswordSet()) return res.redirect('/login/setup');
  if (req.session && req.session.authenticated) return res.redirect('/vehicles');
  res.render('auth/login', { title: 'Log In', error: null });
});

router.post('/login', (req, res) => {
  if (!isPasswordSet()) return res.redirect('/login/setup');

  const lockout = checkLockout(req.ip);
  if (lockout.locked) {
    return res.render('auth/login', { title: 'Log In', error: lockoutMessage(lockout.remainingMs) });
  }

  const { username, password } = req.body;
  if (!verifyCredentials(username, password)) {
    recordFailedLogin(req.ip);
    const after = checkLockout(req.ip);
    const error = after.locked ? lockoutMessage(after.remainingMs) : 'Incorrect username or password.';
    return res.render('auth/login', { title: 'Log In', error });
  }

  clearLoginAttempts(req.ip);
  const returnTo = isSafeReturnTo(req.session && req.session.returnTo) ? req.session.returnTo : '/vehicles';
  req.session.regenerate((err) => {
    if (err) return res.render('auth/login', { title: 'Log In', error: 'Something went wrong. Try again.' });
    req.session.authenticated = true;
    res.redirect(returnTo);
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
