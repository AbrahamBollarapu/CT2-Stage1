import express from "express";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "20mb" }));
const PORT = Number(process.env.PORT || 8000);

const dataDir = "/app/evidence-data";
fs.mkdirSync(dataDir, { recursive: true });

app.get("/health", (_req, res) => res.json({ status: "ok", service: "evidence-store", port: PORT }));

app.post("/save-json", (req: any, res: any) => {
  const sha = String(req.body?.sha || "");
  const dataBase64 = String(req.body?.dataBase64 || "");
  if (!sha || !dataBase64) return res.status(400).json({ ok: false, error: "missing sha or dataBase64" });
  const buf = Buffer.from(dataBase64, "base64");
  fs.writeFileSync(path.join(dataDir, sha), buf);
  res.json({ ok: true, sha });
});

app.get("/blob/:sha", (req, res) => {
  const p = path.join(dataDir, String(req.params.sha));
  if (!fs.existsSync(p)) return res.status(404).json({ ok: false, error: "not found" });
  res.sendFile(p);
});

app.listen(PORT, "0.0.0.0", () => console.log(`[evidence-store] ${PORT}`));
