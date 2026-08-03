#!/usr/bin/env node
// Sets (or resets) the app login username/password directly against the database.
// Run from the server: npm run reset-password
const readline = require('readline');
const { setUsername, setPassword } = require('../src/lib/auth');

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();

  process.stdout.write('Username: ');
  const username = (await lines.next()).value;

  process.stdout.write('New password (min 8 chars, visible as you type): ');
  const password = (await lines.next()).value;

  process.stdout.write('Confirm password: ');
  const confirm = (await lines.next()).value;

  rl.close();

  if (!username || !username.trim()) {
    console.error('Username is required.');
    process.exitCode = 1;
    return;
  }
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

  setUsername(username);
  setPassword(password);
  console.log('\nUsername and password set.');
  console.log('If the app is currently running, restart it to log out any existing sessions:');
  console.log('  systemctl --user restart maintenance-tracker.service');
}

main();
