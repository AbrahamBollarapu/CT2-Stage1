import express, { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import mime from "mime-types";

// ───────────────────────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 8000);
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/var/lib/ct2/artifacts";

// prefer final artifacts over stub; allow list keeps it safe & explicit
const ALLOWED_EXT = [".zip", ".pdf", ".xbrl", ".xml", ".json", ".txt", ".csv", ".xlsx"] as const;
const FINAL_EXT_PREFERENCE = [".zip", ".pdf"]; // Stage-1 flips text -> zip/pdf

// ───────────────────────────────────────────────────────────────────────────────
// Boot
// ───────────────────────────────────────────────────────────────────────────────
const app = express();
app.disable("x-powered-by");

function ensureArtifactsDir() {
  try {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  } catch (e) {
    console.error(`[evidence] failed to ensure artifact dir ${ARTIFACT_DIR}:`, e);
  }
}
ensureArtifactsDir();

// ───────────────────────────────────────────────────────────────────────────────
// Tiny middleware: correlation id + JSON content-type for errors
// ───────────────────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const cid = (req.headers["x-cid"] as string) || crypto.randomBytes(8).toString("hex");
  res.setHeader("x-cid", cid);
  (res as any).cid = cid;
  next();
});

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────
function sanitizeId(id: string): string | null {
  // allow simple ids (hex/uuid/short ids/underscores-dashes)
  if (/^[A-Za-z0-9._-]{1,200}$/.test(id)) return id;
  return null;
}

function chooseArtifactFile(id: string): { full: string; ext: string } | null {
  // If final artifact exists, prefer it; else serve any allowed (often stub .txt)
  for (const ext of FINAL_EXT_PREFERENCE) {
    const p = path.join(ARTIFACT_DIR, `${id}${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return { full: p, ext };
  }
  for (const ext of ALLOWED_EXT) {
    const p = path.join(ARTIFACT_DIR, `${id}${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return { full: p, ext };
  }
  return null;
}

function contentTypeForExt(ext: string): string {
  if (ext === ".zip") return "application/zip";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  const mt = mime.lookup(ext);
  return mt || "application/octet-stream";
}

function setStandardHeaders(res: Response, filePath: string, ext: string, id: string, fileStat: fs.Stats) {
  res.setHeader("Content-Type", contentTypeForExt(ext));
  res.setHeader("Content-Length", String(fileStat.size));
  res.setHeader("Last-Modified", fileStat.mtime.toUTCString());
  res.setHeader("ETag", `"${fileStat.size}-${Number(fileStat.mtimeMs).toString(16)}"`);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Disposition", `inline; filename="${id}${ext}"`);
}

// ───────────────────────────────────────────────────────────────────────────────
// Health & Introspection (mounted at root; Traefik strips /api/evidence)
// ───────────────────────────────────────────────────────────────────────────────
const started = Date.now();

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: process.env.SERVICE_NAME || "evidence-store",
    version: process.env.npm_package_version || process.env.SERVICE_VERSION || "0.0.0",
    uptime_s: Math.floor((Date.now() - started) / 1000),
    dir: ARTIFACT_DIR,
  });
});

app.get("/ready", (_req, res) => {
  // You can add fs writability/dir checks here if needed
  res.json({ ok: true, service: process.env.SERVICE_NAME || "evidence-store" });
});

app.get("/routes", (_req, res) => {
  res.json({
    ok: true,
    service: process.env.SERVICE_NAME || "evidence-store",
    artifact_dir: ARTIFACT_DIR,
    routes: [
      "GET /health",
      "GET /ready",
      "GET /routes",
      "HEAD /artifacts/:id/content",
      "GET /artifacts/:id/content",
      "GET /openapi.json",
    ],
    examples: [
      "/api/evidence/health",
      "/api/evidence/artifacts/abc123/content",
    ],
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// Artifact content (Stage-1): HEAD + GET with Range support and type flip
// ───────────────────────────────────────────────────────────────────────────────
function artifactResponder(method: "HEAD" | "GET") {
  return (req: Request, res: Response) => {
    const rawId = req.params.id;
    const id = sanitizeId(rawId || "");
    if (!id) return res.status(400).json({ ok: false, error: "invalid_artifact_id" });

    const chosen = chooseArtifactFile(id);
    if (!chosen) return res.status(404).json({ ok: false, error: "artifact_not_found", id });

    const { full, ext } = chosen;
    const st = fs.statSync(full);

    // If client asks for a byte range
    const range = req.headers.range as string | undefined;
    setStandardHeaders(res, full, ext, id, st);

    if (method === "HEAD") {
      return res.end();
    }

    if (range) {
      // e.g., "bytes=0-1023"
      const m = range.match(/^bytes=(\d*)-(\d*)$/);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : st.size - 1;
        if (start <= end && end < st.size) {
          res.status(206);
          res.setHeader("Content-Range", `bytes ${start}-${end}/${st.size}`);
          res.setHeader("Content-Length", String(end - start + 1));
          const stream = fs.createReadStream(full, { start, end });
          stream.pipe(res);
          stream.on("close", () => {
            console.log(`[evidence] served range ${start}-${end}/${st.size} ${path.basename(full)}`);
          });
          return;
        }
      }
      // Bad range → 416
      res.status(416).setHeader("Content-Range", `bytes */${st.size}`).end();
      return;
    }

    // Full-body stream
    const stream = fs.createReadStream(full);
    stream.pipe(res);
    stream.on("close", () => {
      console.log(`[evidence] served ${st.size} bytes ${path.basename(full)}`);
    });
  };
}

app.head("/artifacts/:id/content", artifactResponder("HEAD"));
app.get("/artifacts/:id/content", artifactResponder("GET"));

// ───────────────────────────────────────────────────────────────────────────────
/** Minimal OpenAPI surface for quick discovery (optional) */
const OPENAPI = {
  openapi: "3.0.0",
  info: { title: "Evidence Store API", version: "0.1.0" },
  paths: {
    "/health": { get: { summary: "Liveness", responses: { 200: { description: "OK" } } } },
    "/ready": { get: { summary: "Readiness", responses: { 200: { description: "OK" } } } },
    "/routes": { get: { summary: "Introspection", responses: { 200: { description: "OK" } } } },
    "/artifacts/{id}/content": {
      get: {
        summary: "Fetch artifact content",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Artifact bytes" }, 404: { description: "Not found" } },
      },
      head: {
        summary: "Probe artifact content headers",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
      },
    },
  },
};

app.get("/openapi.json", (_req, res) => res.json(OPENAPI));
app.get("/api/evidence/openapi.json", (_req, res) => res.json(OPENAPI)); // convenience

// 404 helper (json)
app.use((_req, res) => res.status(404).json({ ok: false, error: "not_found" }));

// ───────────────────────────────────────────────────────────────────────────────
// Start
// ───────────────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[evidence] listening on ${PORT}, artifacts at ${ARTIFACT_DIR}`);
});
