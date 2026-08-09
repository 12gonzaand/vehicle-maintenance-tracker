#!/usr/bin/env node
// Resets an existing account's password directly against the database.
// Run from the server: npm run reset-password
// This does NOT create accounts — new accounts are self-serve via /register.
const readline = require('readline');
const migrate = require('../src/db/migrate');
const { hashPassword } = require('../src/lib/auth');
const User = require('../src/models/user');

async function main() {
  // server.js always runs this before touching the DB; this script needs
  // the same guarantee, since it can be run against a DB_PATH that's never
  // been opened yet (e.g. right after a fresh deploy, before starting the
  // app for the first time) — without it, the query below fails with a raw
  // "no such table: users" instead of a normal prompt.
  migrate();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();

  process.stdout.write('Username: ');
  const username = (await lines.next()).value;

  const user = User.findByUsername(username);
  if (!user) {
    rl.close();
    console.error(`No account named "${username}". New accounts are created at /register, not here.`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write('New password (min 8 chars, visible as you type): ');
  const password = (await lines.next()).value;

  process.stdout.write('Confirm password: ');
  const confirm = (await lines.next()).value;

  rl.close();

  if (!password || password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }
  if (password !== confirm) {
    console.error('Passwords do not match.');
    process.exitCode = 1;
    return;
  }

  User.updatePassword(user.id, hashPassword(password));
  console.log(`\nPassword reset for "${user.username}".`);
  console.log('If the app is currently running, restart it to log out any existing sessions:');
  console.log('  systemctl --user restart maintenance-tracker.service');
}

main();
