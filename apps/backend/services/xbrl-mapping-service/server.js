import express from "express";
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "xbrl-mapping" }));

app.post("/api/xbrl/map", (req, res) => {
  // Minimal stub: echo what would be mapped
  res.json({ ok: true, mapped: true, inputKeys: Object.keys(req.body || {}) });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`xbrl-mapping on :${PORT}`));
