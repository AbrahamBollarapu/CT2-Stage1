import express from "express";
import fs from "fs";
import { Pool } from "pg";

// ---------- tiny trace middleware ----------
function traceMiddleware(req, res, next) {
  const incoming = req.header("traceparent");
  const rand = () => Math.random().toString(16).slice(2);
  const trace = incoming || `00-${rand().padEnd(32,"0")}-0000000000000000-01`;
  const cid = req.header("x-correlation-id") || rand();
  res.set("traceparent", trace);
  res.set("x-correlation-id", cid);
  const t0 = Date.now();
  res.on("finish", () => {
    console.log(`[trace=${trace}] [corr=${cid}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now()-t0}ms`);
  });
  next();
}

// ---------- build DB URL & PIN host to DB container IP ----------
let conn = process.env.DATABASE_URL || "";
conn = conn.replace(/^postgresql\+psycopg:\/\//, "postgres://"); // normalize
try {
  const u = new URL(conn);
  u.hostname = "evidence-db";          // << your ct2-evidence-db-1 IP
  conn = u.toString();
} catch (e) {
  console.error("DB URL parse error:", e.message);
}

const pool = new Pool({ connectionString: conn });

// ---------- app under /api/evidence ----------
const app = express();
app.use(express.json());
app.use(traceMiddleware);

const base = "/api/evidence";

// health (behind Traefik)
app.get(`${base}/health`, async (_req, res) => {
  try { await pool.query("select 1"); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// small env diag
app.get(`${base}/_diag/env`, (_req, res) => {
  res.json({ raw: process.env.DATABASE_URL || null, effective: conn });
});

// row + file diag
app.get(`${base}/_diag/row/:id`, async (req, res) => {
  try {
    const { rows } = await pool.query("select id, path, mime, size from evidence where id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "row_not_found" });
    const { id, path, mime, size } = rows[0];
    const exists = path && fs.existsSync(path);
    let statSize = null;
    try { statSize = exists ? fs.statSync(path).size : null; } catch { statSize = null; }
    res.json({ id, path, mime, size, file: { exists, statSize } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// metadata upsert (optional, for ingestion follow-up)
app.post(`${base}`, async (req, res) => {
  const { org_id, sha256, size, mime, path: fpath } = req.body || {};
  if (!org_id || !sha256 || !size || !mime || !fpath) {
    return res.status(400).json({ error: "org_id, sha256, size, mime, path required" });
  }
  try {
    const sql = `
      insert into evidence(org_id, sha256, size, mime, path)
      values($1,$2,$3,$4,$5)
      on conflict(sha256) do update set
        size=excluded.size, mime=excluded.mime, path=excluded.path
      returning id
    `;
    const { rows } = await pool.query(sql, [org_id, sha256, size, mime, fpath]);
    res.json({ id: rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// serve bytes by UUID
async function serveById(req, res, isHead = false) {
  try {
    const { rows } = await pool.query("select path, mime, size from evidence where id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "row_not_found" });
    const { path: fpath, mime, size } = rows[0];
    if (!fpath) return res.status(404).json({ error: "no_path" });
    if (!fs.existsSync(fpath)) return res.status(404).json({ error: "file_missing", path: fpath });

    const statSize = size ?? fs.statSync(fpath).size;
    res.setHeader("Content-Type", mime || "application/octet-stream");
    res.setHeader("Content-Length", String(statSize));
    if (isHead) return res.end();

    const stream = fs.createReadStream(fpath);
    stream.on("error", (err) => { console.error("stream error:", err?.message); res.sendStatus(500); });
    stream.pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
app.head(`${base}/:id/content`, (req, res) => serveById(req, res, true));
app.get (`${base}/:id/content`, (req, res) => serveById(req, res, false));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log("evidence-store listening", PORT));
