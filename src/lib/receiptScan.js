const FUEL_GRADES = ['Regular (87)', 'Mid-Grade (89)', 'Premium (91)', 'Premium (93)', 'Diesel', 'E85'];

// Google's flash-tier models change name over time — override via
// GEMINI_MODEL if this default has been superseded. Check
// https://aistudio.google.com/apikey for the currently recommended one.
const DEFAULT_MODEL = 'gemini-2.5-flash';

const SCHEMAS = {
  fuel: {
    type: 'OBJECT',
    properties: {
      fill_date: { type: 'STRING', nullable: true, description: 'Date of the fill-up in YYYY-MM-DD format, or null if not visible.' },
      mileage: { type: 'NUMBER', nullable: true, description: 'Odometer reading in miles, or null if not shown on the receipt.' },
      gallons: { type: 'NUMBER', nullable: true, description: 'Gallons of fuel purchased, or null if not visible.' },
      cost: { type: 'NUMBER', nullable: true, description: 'Total dollar amount paid, or null if not visible.' },
      fuel_grade: {
        type: 'STRING', enum: FUEL_GRADES, nullable: true,
        description: 'Fuel grade purchased, matched to the closest of the allowed values, or null if not stated.'
      }
    }
  },
  service: {
    type: 'OBJECT',
    properties: {
      service_date: { type: 'STRING', nullable: true, description: 'Date the service was performed, in YYYY-MM-DD format, or null if not visible.' },
      mileage: { type: 'NUMBER', nullable: true, description: 'Odometer reading in miles at time of service, or null if not shown.' },
      cost: { type: 'NUMBER', nullable: true, description: 'Total dollar amount charged, or null if not visible.' },
      shop: { type: 'STRING', nullable: true, description: 'Name of the shop/business that performed the service, or null if not identifiable.' },
      service_type: {
        type: 'STRING', nullable: true,
        description: 'A short description of the primary service performed (e.g. "Oil Change", "Brake Replacement", "Tire Rotation"), or null if unclear.'
      }
    }
  }
};

const PROMPTS = {
  fuel: 'This image is a receipt from a gas station fill-up. Extract the requested fields exactly as they appear on the receipt. If a field is not visible or not applicable, return null for it rather than guessing.',
  service: 'This image is a receipt or invoice from an auto repair/maintenance shop. Extract the requested fields exactly as they appear on the receipt. If a field is not visible or not applicable, return null for it rather than guessing.'
};

// kind: 'fuel' | 'service'. mimeType/buffer: the uploaded image (see
// middleware/upload.js's uploadReceiptScan, memory storage — never written
// to disk). Returns the extracted fields object, or throws an Error with a
// message safe to show the user (never includes the API key or raw
// response body, which could echo account details back).
async function scanReceipt({ kind, mimeType, buffer }) {
  const schema = SCHEMAS[kind];
  if (!schema) throw new Error(`Unknown receipt kind: ${kind}`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Receipt scanning isn't configured.");

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const body = {
    contents: [{
      parts: [
        { text: PROMPTS[kind] },
        { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } }
      ]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema
    }
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new Error('Could not reach the receipt-scanning service.');
  }

  if (!response.ok) {
    throw new Error(`Receipt scanning failed (HTTP ${response.status}).`);
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error('Receipt scanning returned an unreadable response.');
  }

  const text = data && data.candidates && data.candidates[0] && data.candidates[0].content
    && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
    && data.candidates[0].content.parts[0].text;
  if (!text) throw new Error('Receipt scanning returned no result.');

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Receipt scanning returned malformed data.');
  }
}

module.exports = { scanReceipt, FUEL_GRADES };
