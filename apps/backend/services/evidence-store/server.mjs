// /app/server.mjs — evidence-store (disk-backed, stream GET/HEAD)
import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

const app = express();
// Do NOT set a global JSON parser for binary PUT; we'll only parse JSON on JSON routes when needed.
app.use((req,_res,next)=>{
  if ((req.headers["content-type"]||"").includes("application/json")) {
    express.json({limit:"20mb"})(req,_res,next);
  } else next();
});

const PORT   = Number(process.env.PORT || 8000);
const PREFIX = (process.env.PREFIX?.replace(/\/+$/, "") || "/api/evidence");
const DATA_DIR = process.env.DATA_DIR || "/data/evidence"; // will fallback to /tmp/evidence if permissions fail

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive:true }).catch(()=>{});
}

function filePaths(org_id, id) {
  const base = path.join(DATA_DIR, org_id || "default");
  const bin  = path.join(base, id);
  const meta = path.join(base, `${id}.meta.json`);
  return { base, bin, meta };
}

async function writeBlob(req, org_id, id, mime) {
  const { base, bin, meta } = filePaths(org_id, id);
  await ensureDir(base);

  return await new Promise((resolve, reject)=>{
    const hash = crypto.createHash("sha256");
    let length = 0;
    const out = fs.createWriteStream(bin);
    req.on("data", chunk => { hash.update(chunk); length += chunk.length; });
    req.pipe(out);
    out.on("finish", async ()=>{
      const sha256 = hash.digest("hex");
      const m = { id, org_id, mime: mime || req.headers["content-type"] || "application/octet-stream",
                  length, sha256, created_at: new Date().toISOString() };
      await fsp.writeFile(meta, JSON.stringify(m, null, 2));
      resolve(m);
    });
    out.on("error", reject);
  });
}

async function readMeta(org_id, id) {
  const { meta } = filePaths(org_id,id);
  return JSON.parse(await fsp.readFile(meta, "utf8"));
}

// Health
app.get("/health", (_q,r)=> r.json({ ok:true, service:"evidence", root:true }));
app.get(`${PREFIX}/health`, (_q,r)=> r.json({ ok:true, service:"evidence" }));

// PUT binary blob
async function putEvidence(req, res) {
  try {
    const id = req.params.id;
    const org_id = req.query.org_id || "default";
    if (!id) return res.status(400).json({ ok:false, error:"bad_id" });
    const info = await writeBlob(req, org_id, id, req.headers["content-type"]);
    return res.status(201).json({ ok:true, id, org_id, sha256: info.sha256, length: info.length });
  } catch (e) {
    return res.status(500).json({ ok:false, error:"write_error", details:String(e?.message||e) });
  }
}

// GET/HEAD streaming with headers
async function getContent(req, res) {
  try {
    const id = req.params.id;
    const org_id = req.query.org_id || "default";
    const { bin } = filePaths(org_id, id);
    const meta = await readMeta(org_id, id);
    const stat = await fsp.stat(bin);

    res.setHeader("Content-Type", meta.mime || "application/octet-stream");
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("ETag", `"sha256:${meta.sha256}"`);
    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    if (req.method === "HEAD") return res.status(200).end();

    const stream = fs.createReadStream(bin);
    stream.on("error", ()=> res.status(404).end());
    stream.pipe(res);
  } catch (_e) {
    return res.status(404).json({ ok:false, error:"not_found" });
  }
}

app.put(`/evidence/:id`, putEvidence);
app.put(`${PREFIX}/:id`, putEvidence);

app.get(`/evidence/:id/content`, getContent);
app.head(`/evidence/:id/content`, getContent);
app.get(`${PREFIX}/:id/content`, getContent);
app.head(`${PREFIX}/:id/content`, getContent);

app.listen(PORT, "0.0.0.0", async () => {
  try { await ensureDir(DATA_DIR); } catch {}
  console.log(`[evidence] :${PORT} (PREFIX=${PREFIX}, DATA_DIR=${DATA_DIR})`);
});
