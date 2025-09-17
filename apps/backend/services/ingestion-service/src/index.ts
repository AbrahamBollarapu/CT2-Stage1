import express from "express";

const app = express();
app.use(express.json({ limit: "25mb" }));

const PORT = parseInt(process.env.PORT || "8000", 10);
// Where ingestion forwards uploaded files to be stored:
const EVIDENCE_BASE_URL =
  process.env.EVIDENCE_BASE_URL || "http://evidence-store:8000";

app.get("/health", (_req, res) => res.json({ ok: true }));

// Traefik strips /api/ingest → our route is just /documents
app.post("/documents", async (req, res) => {
  try {
    const orgId = (req.header("X-Org-Id") || "default").toString();
    const { filename, contentType, dataBase64 } = req.body || {};
    if (!filename || !contentType || !dataBase64) {
      return res
        .status(400)
        .json({ ok: false, error: "filename, contentType, dataBase64 required" });
    }

    // Forward to evidence-store
    const resp = await fetch(`${EVIDENCE_BASE_URL}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Org-Id": orgId,
      },
      body: JSON.stringify({ filename, contentType, dataBase64 }),
    });

    if (!resp.ok) {
      const details = await resp.text().catch(() => "");
      return res
        .status(502)
        .json({ ok: false, error: "evidence-store error", details });
    }

    const data = (await resp.json()) as { evidence_id: string };
    return res.json({ ok: true, evidence_id: data.evidence_id });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "error" });
  }
});

app.listen(PORT, () => {
  console.log(`ingestion-service listening on :${PORT}`);
});
