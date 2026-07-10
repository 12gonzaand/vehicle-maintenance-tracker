const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

router.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/vehicles');
  res.render('auth/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { password } = req.body;
  const hash = process.env.AUTH_PASSWORD_HASH;
  const valid = hash && password && (await bcrypt.compare(password, hash));

  if (!valid) {
    return res.status(401).render('auth/login', { error: 'Incorrect password' });
  }

  req.session.authenticated = true;
  res.redirect('/vehicles');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
