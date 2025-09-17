import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mime from "mime";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

const EVIDENCE_ID = "sample";
const EVIDENCE_FILE = path.join(__dirname, "evidence", "sample.pdf");

app.get(["/health", "/api/evidence/health"], (req, res) => res.json({ ok: true, service: "evidence-store" }));

app.get("/list", (req, res) => res.json([{ id: EVIDENCE_ID, name: "sample.pdf", size: fs.existsSync(EVIDENCE_FILE) ? fs.statSync(EVIDENCE_FILE).size : 0 }]));

app.head("/evidence/:id/content", (req, res) => {
  const id = req.params.id;
  if (id !== EVIDENCE_ID || !fs.existsSync(EVIDENCE_FILE)) return res.sendStatus(404);
  const type = mime.getType(EVIDENCE_FILE) || "application/octet-stream";
  const size = fs.statSync(EVIDENCE_FILE).size;
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", size.toString());
  res.setHeader("Content-Disposition", "inline; filename=\"sample.pdf\"");
  res.status(200).end();
});

app.get("/evidence/:id/content", (req, res) => {
  const id = req.params.id;
  if (id !== EVIDENCE_ID || !fs.existsSync(EVIDENCE_FILE)) return res.sendStatus(404);
  res.setHeader("Content-Disposition", "inline; filename=\"sample.pdf\"");
  res.sendFile(EVIDENCE_FILE);
});

app.listen(PORT, () => console.log(`[evidence-store] listening on :${PORT}`));