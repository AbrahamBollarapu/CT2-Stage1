import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const STORE = process.env.EVIDENCE_DIR || "/data/evidence";

router.get("/:sha256", (req, res) => {
  const sha = (req.params.sha256 || "").replace(/[^a-f0-9]/gi, "").toLowerCase();
  if (!sha) return res.status(400).json({ error: "sha256 required" });

  const filePath = path.join(STORE, `${sha}.bin`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "not found" });

  res.setHeader("Content-Type", "application/pdf");
  res.sendFile(filePath);
});

export default router;
