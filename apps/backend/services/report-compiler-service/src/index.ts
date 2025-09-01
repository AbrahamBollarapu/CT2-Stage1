import express, { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import crypto from "node:crypto";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8000);
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/var/lib/ct2/artifacts";
const ORG_DEFAULT = process.env.ORG_DEFAULT || "demo";
const BUILD_DELAY_MS = Number(process.env.BUILD_DELAY_MS || 1000);

type BuildState = "processing" | "completed";
type StatusEntry = { state: BuildState; org: string };

const statusMap = new Map<string, StatusEntry>();

function getOrgId(req: Request): string {
  const h = (req.headers["x-org-id"] || req.headers["x-orgid"] || "") as string;
  const q = (req.query.org || req.query.org_id || "") as string;
  return (h || q || ORG_DEFAULT).toString();
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

function id24() {
  return crypto.randomBytes(12).toString("hex"); // 24-char hex
}

function stubContent(artifactId: string, org: string) {
  const now = new Date().toISOString();
  return `S1 stub for artifact ${artifactId}
org=${org}
generated=${now}
`;
}

function minimalPdfBuffer(artifactId: string, org: string) {
  // Tiny valid-ish PDF (enough for Content-Type demo)
  const body = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 50]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>
endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 20 25 Td (artifact ${artifactId} org=${org}) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000071 00000 n 
0000000134 00000 n 
0000000307 00000 n 
0000000435 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
540
%%EOF`;
  return Buffer.from(body, "utf8");
}

function artifactPath(org: string, id: string, ext: "txt" | "pdf") {
  return path.join(ARTIFACT_DIR, org, `${id}.${ext}`);
}

async function writeStub(org: string, id: string) {
  const dir = path.join(ARTIFACT_DIR, org);
  await ensureDir(dir);
  await fs.writeFile(artifactPath(org, id, "txt"), stubContent(id, org), "utf8");
}

async function writeFinal(org: string, id: string) {
  const dir = path.join(ARTIFACT_DIR, org);
  await ensureDir(dir);
  await fs.writeFile(artifactPath(org, id, "pdf"), minimalPdfBuffer(id, org));
}

function createFallbackRouter() {
  const r = express.Router();

  r.get("/health", (_req, res) => {
    res.json({ ok: true, service: "report-compiler-service", version: "1.0.0", uptime_s: process.uptime().toFixed(0), host: process.env.HOSTNAME || "unknown" });
  });

  r.get("/ready", (_req, res) => res.sendStatus(200));

  r.get("/routes", (_req, res) => {
    res.json({
      ok: true,
      service: "report-compiler-service",
      base: "/",
      routes: ["/health", "/ready", "/routes", "/build (POST)", "/status/:artifactId"],
    });
  });

  r.post("/build", express.json(), async (req: Request, res: Response) => {
    try {
      const org = getOrgId(req);
      const artifactId = id24();

      await writeStub(org, artifactId);
      statusMap.set(artifactId, { state: "processing", org });

      // Simulate async compile → final pdf
      setTimeout(async () => {
        try {
          await writeFinal(org, artifactId);
          statusMap.set(artifactId, { state: "completed", org });
          console.log("[report-compiler] artifact_persisted", { org, artifactId, dir: path.join(ARTIFACT_DIR, org) });
        } catch (e) {
          console.error("[report-compiler] final_write_error", e);
        }
      }, BUILD_DELAY_MS);

      console.log("[report-compiler] report_build_requested", { org, artifactId });
      res.status(202).json({ ok: true, artifactId });
    } catch (e: any) {
      console.error("[report-compiler] build_error", e);
      res.status(500).json({ ok: false, error: "build_failed" });
    }
  });

  r.get("/status/:artifactId", async (req: Request, res: Response) => {
    const id = req.params.artifactId;
    const known = statusMap.get(id);
    if (known) {
      return res.json({ ok: true, artifactId: id, org: known.org, state: known.state });
    }

    // Fallback: if not in memory (e.g., after restart), infer by probing default org
    const probeOrg = (req.query.org as string) || ORG_DEFAULT;
    const pdf = artifactPath(probeOrg, id, "pdf");
    const txt = artifactPath(probeOrg, id, "txt");
    const done = existsSync(pdf);
    const started = existsSync(txt);

    if (done) return res.json({ ok: true, artifactId: id, org: probeOrg, state: "completed" });
    if (started) return res.json({ ok: true, artifactId: id, org: probeOrg, state: "processing" });
    return res.status(404).json({ ok: false, error: "not_found" });
  });

  return r;
}

async function main() {
  const app = express();

  // Try to load real router if present; otherwise fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const real = require("./reports-api");
    console.log("[report-compiler-service] using ./reports-api router");
    app.use("/", real.default ? real.default : real);
  } catch {
    console.log("[report-compiler-service] ./reports-api not found — using fallback S1 router (build/status/routes) with org-partitioning");
    app.use("/", createFallbackRouter());
  }

  await ensureDir(ARTIFACT_DIR);
  console.log("[report-compiler-service] listening on %d, artifacts at %s", PORT, ARTIFACT_DIR);

  app.listen(PORT, HOST);
}

main().catch((e) => {
  console.error("fatal", e);
  process.exit(1);
});
