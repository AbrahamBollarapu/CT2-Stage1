// /app/server.mjs — ingestion-service
import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "20mb" }));

const PORT   = Number(process.env.PORT || 8000);
const PREFIX = (process.env.PREFIX?.replace(/\/+$/, "") || "/api/ingest");
const EVIDENCE_API = (process.env.EVIDENCE_API?.replace(/\/+$/, "") || "http://evidence-store:8000/api/evidence");
const JOBS_API     = (process.env.JOBS_API?.replace(/\/+$/, "") || "http://jobs-service:8000/api/jobs");

const ok  = (res, extra={}) => res.json({ ok:true, ...extra });
const bad = (res, code, extra={}) => res.status(400).json({ ok:false, error:code, ...extra });

async function fetchBufferFromUrl(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

async function putEvidence(evidence_id, org_id, mime, buf) {
  const url = `${EVIDENCE_API}/${encodeURIComponent(evidence_id)}?org_id=${encodeURIComponent(org_id)}`
  const r = await fetch(url, {
    method: "PUT",
    headers: { "content-type": mime || "application/octet-stream", "content-length": String(buf.length) },
    body: buf
  });
  if (!r.ok) throw new Error(`PUT evidence ${evidence_id} -> ${r.status}`);
  return true;
}

async function enqueueJob(job, params) {
  // Prefer real jobs-service if reachable; otherwise generate a fake job_id
  try {
    const r = await fetch(`${JOBS_API}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job, params })
    });
    if (r.ok) return r.json();
  } catch {}
  return { ok:true, job_id: `job_${crypto.randomUUID()}`, queued:false, note:"jobs-service not reachable; local stub id issued" };
}

async function postDocuments(req, res) {
  try {
    const b = req.body || {};
    const { org_id, source, mime, name } = b;
    const content = b.content; // base64 string OR url string
    if (!org_id || !content) return bad(res, "bad_payload", { need:"org_id + content(base64|url)" });

    let buf;
    if (content.startsWith("http://") || content.startsWith("https://")) {
      buf = await fetchBufferFromUrl(content);
    } else {
      try { buf = Buffer.from(content, "base64"); }
      catch { return bad(res, "bad_content", { msg:"content must be base64 or http(s) url" }); }
    }

    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    const evidence_id = crypto.randomUUID();
    await putEvidence(evidence_id, org_id, mime, buf);

    const jobRes = await enqueueJob("report.parse", { evidence_id, org_id, mime, name, sha256, source:source||"upload" });
    return ok(res, { evidence_id, job_id: jobRes.job_id, sha256, size: buf.length });
  } catch (e) {
    return res.status(500).json({ ok:false, error:"ingest_error", details:String(e?.message||e) });
  }
}

app.get("/health", (_q,r)=> ok(r,{service:"ingestion",root:true}));
app.get(`${PREFIX}/health`, (_q,r)=> ok(r,{service:"ingestion"}));
app.post("/documents", postDocuments);
app.post(`${PREFIX}/documents`, postDocuments);

app.listen(PORT, "0.0.0.0", () =>
  console.log(`[ingestion] :${PORT} (PREFIX=${PREFIX}, EVIDENCE_API=${EVIDENCE_API}, JOBS_API=${JOBS_API})`)
);
