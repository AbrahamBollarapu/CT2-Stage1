import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 8000);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "evidence-store", port: PORT });
});

app.get("/blob/:sha", (req, res) => {
  const sha = req.params.sha;
  const p = path.join(__dirname, "evidence-data", sha);
  if (!fs.existsSync(p)) return res.status(404).json({ error: "not found" });
  res.setHeader("Content-Type", "application/octet-stream");
  fs.createReadStream(p).pipe(res);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[evidence-store] listening on ${PORT}`);
});
