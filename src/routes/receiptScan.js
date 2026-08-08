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
// Up to 6 images per scan — enough for any realistic multi-page invoice;
// multer rejects a 7th with a normal error, surfaced the same as any other
// upload error below.
router.post('/', (req, res) => {
  uploadReceiptScan.array('receipt', 6)(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ ok: false, error: uploadErr.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ ok: false, error: 'No receipt image was uploaded.' });
    }
    const kind = req.body.kind;
    if (!VALID_KINDS.has(kind)) {
      return res.status(400).json({ ok: false, error: 'Invalid receipt kind.' });
    }

    try {
      const files = req.files.map((f) => ({ mimeType: f.mimetype, buffer: f.buffer }));
      const fields = await scanReceipt({ kind, files });
      res.json({ ok: true, fields });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });
});

module.exports = router;
