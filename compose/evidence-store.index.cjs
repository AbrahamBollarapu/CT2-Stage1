const express = require("express");
const fs = require("fs");
const { Pool } = require("pg");

// Minimal trace middleware (CommonJS-safe)
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

// Normalize SQLAlchemy-style URL to node-postgres
let dbUrl = process.env.DATABASE_URL || "";
dbUrl = dbUrl.replace(/^postgresql\+psycopg:\/\//, "postgres://");
const pool = new Pool({ connectionString: dbUrl });

const app = express();
app.use(express.json());
app.use(traceMiddleware);

app.get("/health", async (_req, res) => {
  try { await pool.query("select 1"); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/** Upsert evidence by sha256; return UUID id */
app.post("/api/evidence", async (req, res) => {
  const { org_id, sha256, size, mime, path } = req.body || {};
  if (!org_id || !sha256 || !size || !mime || !path) {
    return res.status(400).json({ error: "org_id, sha256, size, mime, path required" });
  }
  try {
    const sql = `
      insert into evidence(org_id, sha256, size, mime, path)
      values($1,$2,$3,$4,$5)
      on conflict(sha256) do update
        set size=excluded.size, mime=excluded.mime, path=excluded.path
      returning id
    `;
    const { rows } = await pool.query(sql, [org_id, sha256, size, mime, path]);
    res.json({ id: rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Serve bytes by UUID id */
async function serveById(req, res, isHead = false) {
  try {
    const { rows } = await pool.query("select path, mime, size from evidence where id = $1", [req.params.id]);
    if (!rows.length) return res.sendStatus(404);
    const { path, mime, size } = rows[0];
    if (!path || !fs.existsSync(path)) return res.sendStatus(404);

    res.setHeader("Content-Type", mime || "application/octet-stream");
    res.setHeader("Content-Length", String(size ?? fs.statSync(path).size));
    if (isHead) return res.end();

    const stream = fs.createReadStream(path);
    stream.on("error", () => res.sendStatus(500));
    stream.pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
app.head("/api/evidence/:id/content", (req, res) => serveById(req, res, true));
app.get ("/api/evidence/:id/content", (req, res) => serveById(req, res, false));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log("evidence-store listening", PORT));
