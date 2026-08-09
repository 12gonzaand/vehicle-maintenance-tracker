const db = require('../db');

const User = {
  find(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByUsername(username) {
    if (typeof username !== 'string') return undefined;
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  },

  create({ username, passwordHash }) {
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const result = stmt.run(username.trim(), passwordHash);
    return this.find(result.lastInsertRowid);
  },

  updatePassword(id, passwordHash) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  },

  updateDisplayName(id, displayName) {
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName || null, id);
  }
};

module.exports = User;
