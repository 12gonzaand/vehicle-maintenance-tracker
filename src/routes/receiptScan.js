const express = require('express');
const router = express.Router({ mergeParams: true });
const { uploadReceiptScan } = require('../middleware/upload');
const { scanReceipt } = require('../lib/receiptScan');

const VALID_KINDS = new Set(['fuel', 'service']);

// Always responds with { ok: true, fields } or { ok: false, error } —
// never a bare 500 — so a Gemini failure/misconfiguration/quota limit
// just means "fill in manually," not a broken page. req.vehicle (set by
// the app.js-level loadOwnedVehicle middleware) isn't used for anything
// beyond the ownership gate itself; this route doesn't touch the DB.
router.post('/', (req, res) => {
  uploadReceiptScan.single('receipt')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ ok: false, error: uploadErr.message });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No receipt image was uploaded.' });
    }
    const kind = req.body.kind;
    if (!VALID_KINDS.has(kind)) {
      return res.status(400).json({ ok: false, error: 'Invalid receipt kind.' });
    }

    try {
      const fields = await scanReceipt({ kind, mimeType: req.file.mimetype, buffer: req.file.buffer });
      res.json({ ok: true, fields });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });
});

module.exports = router;
