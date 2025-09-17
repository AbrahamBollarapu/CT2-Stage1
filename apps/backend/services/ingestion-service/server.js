import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';
import { traceMiddleware } from '../_shared/express-trace.js';

const app = express();
app.use(express.json({ limit: '25mb' }));     // JSON uploads (base64) up to ~25MB
app.use(traceMiddleware);                     // tracing + correlation
const upload = multer({ dest: '/tmp' });

const PORT = process.env.PORT || 8000;
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || '/evidence';
const EVI_API = process.env.EVIDENCE_API_URL || 'http://evidence-store:8000/api/evidence';

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

app.get('/health', (_, res) => res.json({ ok: true, service: 'ingestion-service' }));

// Utility: compute sha256 from a Buffer
function sha256Buf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Save a buffer -> /evidence/<sha256>; post metadata -> evidence-store
async function persistAndRegister({ buf, mime, org_id = '00000000-0000-0000-0000-000000000000' }, headers = {}) {
  const digest = sha256Buf(buf);
  const dest = path.join(EVIDENCE_DIR, digest);
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, buf);

  const stat = fs.statSync(dest);
  const meta = {
    org_id,
    sha256: digest,
    size: stat.size,
    mime: mime || 'application/octet-stream',
    path: dest
  };
  const r = await axios.post(EVI_API, meta, { timeout: 10000, headers });
  return { evidence_id: r.data.id, ...meta };
}

/**
 * POST /api/ingest/documents
 * Accepts EITHER:
 *   1) multipart/form-data -> field name: "file"
 *   2) application/json { filename, contentType, dataBase64 }
 */
app.post('/api/ingest/documents', upload.single('file'), async (req, res) => {
  try {
    const headers = req.traceHeaders || {};

    // (1) multipart/form-data path
    if (req.file) {
      const tmp = req.file.path;
      const buf = fs.readFileSync(tmp);
      const mime = req.file.mimetype || 'application/octet-stream';
      const out = await persistAndRegister({ buf, mime }, headers);
      try { fs.unlinkSync(tmp); } catch {}
      return res.json(out);
    }

    // (2) application/json base64 path
    if (req.is('application/json')) {
      const { filename, contentType, dataBase64, org_id } = req.body || {};
      if (!filename || !contentType || !dataBase64) {
        return res.status(400).json({
          error: 'filename, contentType, dataBase64 required'
        });
      }
      const buf = Buffer.from(dataBase64, 'base64');
      const out = await persistAndRegister({ buf, mime: contentType, org_id }, headers);
      return res.json(out);
    }

    // Unsupported content-type
    return res.status(415).json({ error: 'Unsupported Media Type. Use multipart/form-data (file=...) or application/json with filename/contentType/dataBase64.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'ingest failed' });
  }
});

app.listen(PORT, () => console.log('ingestion listening', PORT));
