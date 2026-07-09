const db = require('../db');

const ServiceFile = {
  allForRecord(recordId) {
    return db.prepare('SELECT * FROM service_files WHERE service_record_id = ? ORDER BY created_at ASC').all(recordId);
  },

  find(id) {
    return db.prepare('SELECT * FROM service_files WHERE id = ?').get(id);
  },

  create(recordId, { original_filename, stored_path, mime_type, size_bytes }) {
    const stmt = db.prepare(`
      INSERT INTO service_files (service_record_id, original_filename, stored_path, mime_type, size_bytes)
      VALUES (@service_record_id, @original_filename, @stored_path, @mime_type, @size_bytes)
    `);
    const result = stmt.run({
      service_record_id: recordId,
      original_filename,
      stored_path,
      mime_type,
      size_bytes
    });
    return this.find(result.lastInsertRowid);
  },

  delete(id) {
    db.prepare('DELETE FROM service_files WHERE id = ?').run(id);
  }
};

module.exports = ServiceFile;
