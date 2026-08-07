const express = require('express');
const {
  hashPassword, verifyCredentials, isSafeReturnTo,
  checkLockout, recordFailedLogin, clearLoginAttempts
} = require('../lib/auth');
const User = require('../models/user');
const ServiceType = require('../models/serviceType');

const router = express.Router();

function lockoutMessage(remainingMs) {
  const minutes = Math.ceil(remainingMs / 60000);
  return `Too many incorrect attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

router.get('/register', (req, res) => {
  res.render('auth/register', { title: 'Register', error: null });
});

router.post('/register', (req, res) => {
  const { username, password, confirm_password } = req.body;
  const render = (error) => res.render('auth/register', { title: 'Register', error });

  if (!username || !username.trim() || username.trim().length < 3) {
    return render('Username must be at least 3 characters.');
  }
  if (!password || password.length < 8) {
    return render('Password must be at least 8 characters.');
  }
  if (password !== confirm_password) {
    return render('Passwords do not match.');
  }
  if (User.findByUsername(username)) {
    return render('That username is already taken.');
  }

  const user = User.create({ username, passwordHash: hashPassword(password) });
  ServiceType.seedDefaults(user.id);

  req.session.regenerate((err) => {
    if (err) return render('Something went wrong. Try again.');
    req.session.userId = user.id;
    res.redirect('/vehicles');
  });
});

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/vehicles');
  res.render('auth/login', { title: 'Log In', error: null });
});

router.post('/login', (req, res) => {
  const lockout = checkLockout(req.ip);
  if (lockout.locked) {
    return res.render('auth/login', { title: 'Log In', error: lockoutMessage(lockout.remainingMs) });
  }

  const { username, password } = req.body;
  const user = verifyCredentials(username, password);
  if (!user) {
    recordFailedLogin(req.ip);
    const after = checkLockout(req.ip);
    const error = after.locked ? lockoutMessage(after.remainingMs) : 'Incorrect username or password.';
    return res.render('auth/login', { title: 'Log In', error });
  }

  clearLoginAttempts(req.ip);
  const returnTo = isSafeReturnTo(req.session && req.session.returnTo) ? req.session.returnTo : '/vehicles';
  req.session.regenerate((err) => {
    if (err) return res.render('auth/login', { title: 'Log In', error: 'Something went wrong. Try again.' });
    req.session.userId = user.id;
    res.redirect(returnTo);
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
