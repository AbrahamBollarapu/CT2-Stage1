// /app/server.mjs — report-compiler (no deps, pure Node)
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { promises as fs } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.PORT || 8000);
const PREFIX = (process.env.PREFIX || "/api/reports").replace(/\/+$/, "");
const REPORTS_DIR = process.env.REPORTS_DIR || ""; // e.g. /data/reports (mounted volume recommended)

const jobs = new Map();      // job_id -> { state, artifact_id, params, created_at }
const artifacts = new Map(); // artifact_id -> { buf, created_at }

// ---------- helpers ----------
function sendJSON(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(body.length),
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function normalizeId(raw) {
  // strip trailing slashes, optional ".zip", and trailing "/download"
  let id = raw.replace(/\/+$/, "");
  id = id.replace(/\/download$/, "");
  id = id.replace(/\.zip$/, "");
  return id;
}

function latestArtifactId() {
  let best = null;
  for (const [id, v] of artifacts.entries()) {
    if (!best || v.created_at > best.created_at) best = { id, created_at: v.created_at };
  }
  return best?.id;
}

async function persistArtifactToDisk(artifact_id, buf) {
  if (!REPORTS_DIR) return false;
  try {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
    await fs.writeFile(join(REPORTS_DIR, `${artifact_id}.zip`), buf);
    return true;
  } catch (e) {
    console.warn("[reports] write artifact failed:", e?.message || e);
    return false;
  }
}

async function readArtifactFromDisk(artifact_id) {
  if (!REPORTS_DIR) return null;
  try {
    const p = join(REPORTS_DIR, `${artifact_id}.zip`);
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

async function listDiskArtifacts() {
  if (!REPORTS_DIR) return [];
  try {
    const files = await fs.readdir(REPORTS_DIR);
    return files
      .filter((f) => f.toLowerCase().endsWith(".zip"))
      .map((f) => f.replace(/\.zip$/i, ""));
  } catch {
    return [];
  }
}

async function resolveLatest() {
  // Prefer memory, then disk (first item is fine for stub)
  let id = latestArtifactId();
  if (!id) {
    const disk = await listDiskArtifacts();
    id = disk[0];
  }
  return id || null;
}

// ---------- server ----------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;

  // Health (root & namespaced)
  if (req.method === "GET" && (p === "/health" || p === `${PREFIX}/health`)) {
    return sendJSON(res, 200, { ok: true, service: "reports" });
  }

  // Build (root & namespaced)
  if (req.method === "POST" && (p === "/build" || p === `${PREFIX}/build`)) {
    try {
      const body = await parseBody(req);
      const { org_id = "demo", template = "default", period = "2024-Q4" } = body || {};

      const job_id = randomUUID();
      const artifact_id = randomUUID();
      const params = { org_id, template, period };

      jobs.set(job_id, { state: "queued", artifact_id, params, created_at: Date.now() });

      setTimeout(async () => {
        const content = `Report artifact (stub)\norg=${org_id}\nperiod=${period}\ntemplate=${template}\n`;
        const buf = Buffer.from(content, "utf8");
        artifacts.set(artifact_id, { buf, created_at: Date.now() });
        await persistArtifactToDisk(artifact_id, buf);
        jobs.set(job_id, { ...jobs.get(job_id), state: "done" });
      }, 700);

      return sendJSON(res, 202, { ok: true, job_id, artifact_id, state: "queued" });
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: "bad_request", details: String(e?.message || e) });
    }
  }

  // Status (root & namespaced)
  if (req.method === "GET" && (p.startsWith("/status/") || p.startsWith(`${PREFIX}/status/`))) {
    const id = p.startsWith(PREFIX) ? p.slice(`${PREFIX}/status/`.length) : p.slice("/status/".length);
    const job = jobs.get(id);
    if (!job) return sendJSON(res, 404, { ok: false, error: "unknown_job" });
    return sendJSON(res, 200, { ok: true, job_id: id, state: job.state, artifact_id: job.artifact_id, params: job.params });
  }

  // Artifacts list (root & namespaced)
  if (req.method === "GET" && (p === "/artifacts" || p === `${PREFIX}/artifacts`)) {
    const memIds = Array.from(artifacts.keys());
    const diskIds = await listDiskArtifacts();
    const set = new Set([...memIds, ...diskIds]);
    return sendJSON(res, 200, { ok: true, count: set.size, ids: Array.from(set) });
  }

  // Latest artifact id (root & namespaced)
  if (req.method === "GET" && (p === "/artifacts/latest" || p === `${PREFIX}/artifacts/latest`)) {
    const id = await resolveLatest();
    if (!id) return sendJSON(res, 404, { ok: false, error: "no_artifacts" });
    return sendJSON(res, 200, { ok: true, artifact_id: id });
  }

  // Artifact info / download / accessories (root & namespaced)
  if ((req.method === "GET" || req.method === "HEAD") && (p.startsWith("/artifacts/") || p.startsWith(`${PREFIX}/artifacts/`))) {
    const base = p.startsWith(PREFIX) ? `${PREFIX}/artifacts/` : "/artifacts/";
    let rest = p.slice(base.length).replace(/\/+$/, "");

    // Resolve 'latest' for any nested route (e.g., /latest/info, /latest/validation.log)
    if (rest === "latest" || rest.startsWith("latest/")) {
      const id = await resolveLatest();
      if (!id) return sendJSON(res, 404, { ok: false, error: "no_artifacts" });
      rest = rest.replace(/^latest/, id);
    }

    // /:id/info
    if (rest.endsWith("/info") && req.method === "GET") {
      const id = normalizeId(rest.slice(0, -"/info".length));
      const obj = artifacts.get(id);
      let size = obj?.buf?.length ?? null;
      if (size == null) {
        const onDisk = await readArtifactFromDisk(id);
        if (onDisk) size = onDisk.length;
      }
      if (size == null) return sendJSON(res, 404, { ok: false, error: "unknown_artifact" });
      return sendJSON(res, 200, { ok: true, artifact_id: id, size });
    }

    // /:id/validation.log or /:id/coverage.json
    if (rest.endsWith("/validation.log") || rest.endsWith("/coverage.json")) {
      const kind = rest.endsWith("/validation.log") ? "validation.log" : "coverage.json";
      const id = normalizeId(rest.replace(/\/(validation\.log|coverage\.json)$/, ""));

      // require that artifact exists (memory or disk)
      let exists = artifacts.has(id);
      if (!exists) exists = !!(await readArtifactFromDisk(id));
      if (!exists) return sendJSON(res, 404, { ok: false, error: "unknown_artifact" });

      if (kind === "validation.log") {
        const text = `VALIDATION LOG (stub)\nstatus=OK\nerrors=0\nwarnings=0\nartifact=${id}\n`;
        const buf = Buffer.from(text, "utf8");
        res.writeHead(200, {
          "content-type": "text/plain; charset=utf-8",
          "content-length": String(buf.length)
        });
        return res.end(buf);
      }
      const json = { ok: true, score: 5, max: 5, artifact_id: id, checks: [] };
      const body = Buffer.from(JSON.stringify(json));
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-length": String(body.length)
      });
      return res.end(body);
    }

    // allow "/:id", "/:id/", "/:id.zip", "/:id/download"
    const id = normalizeId(rest);
    let obj = artifacts.get(id);
    let buf = obj?.buf;
    if (!buf) buf = await readArtifactFromDisk(id);
    if (!buf) return sendJSON(res, 404, { ok: false, error: "unknown_artifact" });

    // HEAD only
    if (req.method === "HEAD") {
      res.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="report-${id}.zip"`,
        "content-length": String(buf.length),
        "x-artifact-stub": "true"
      });
      return res.end();
    }

    // GET with body
    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="report-${id}.zip"`,
      "content-length": String(buf.length),
      "x-artifact-stub": "true"
    });
    return res.end(buf);
  }

  // Fallback
  sendJSON(res, 404, { ok: false, error: "not_found", path: p });
});

server.listen(PORT, "0.0.0.0", () =>
  console.log(`[report-compiler] listening :${PORT} (PREFIX=${PREFIX}, REPORTS_DIR=${REPORTS_DIR || "-"})`)
);
