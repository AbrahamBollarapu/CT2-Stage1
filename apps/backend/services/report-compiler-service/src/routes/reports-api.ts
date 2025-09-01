import { Router } from "express";
import fs from "fs";
import path from "path";
import { persistArtifact } from "../persistArtifact";
import { compileReport } from "../worker/compile";

const router = Router();
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/var/lib/ct2/artifacts";

async function ensureDir() {
  await fs.promises.mkdir(ARTIFACT_DIR, { recursive: true });
}

async function writeStage1Stub(artifactId: string) {
  await ensureDir();
  const stub = path.join(ARTIFACT_DIR, `${artifactId}.txt`);
  const line = `Artifact ${artifactId} scheduled at ${new Date().toISOString()}\n`;
  await fs.promises.writeFile(stub, line);
  console.log("[reports-api] stub_written", { artifactId, file: stub });
}

// Route introspection
router.get("/routes", async (_req, res) => {
  res.json({
    ok: true,
    artifact_dir: ARTIFACT_DIR,
    routes: ["/routes (GET)", "/build (POST)", "/stub/:id (POST)"],
  });
});

// Manually create a stub for a given id
router.post("/stub/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "missing_id" });
    await writeStage1Stub(id);
    return res.json({ ok: true, artifactId: id, stub: true });
  } catch (e: any) {
    console.error("[reports-api] stub_error", e);
    return res.status(500).json({ ok: false, error: "stub_error" });
  }
});

// Enqueue a build → stub immediately, then background compile persists real artifact
router.post("/build", async (req, res) => {
  try {
    const { template, period } = (req.body || {}) as { template?: string; period?: string };
    const ts = Date.now();
    const jobId = `job_${ts}`;
    const artifactId = `rep_${ts}`;

    await writeStage1Stub(artifactId);

    (async () => {
      try {
        const compiled = await compileReport({ template, period, artifactId });
        await persistArtifact({ artifactId, data: compiled, ext: ".zip" });
      } catch (err) {
        console.error("[reports-api] background_build_error", { artifactId, err });
      }
    })();

    return res.json({ ok: true, jobId, artifactId, queued: true });
  } catch (e: any) {
    console.error("[reports-api] build_error", e);
    return res.status(500).json({ ok: false, error: "build_error" });
  }
});

export default router;
