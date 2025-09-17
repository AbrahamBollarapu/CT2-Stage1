import express from "express";
const app = express();
const PORT = process.env.PORT || 8000;

app.get(["/health", "/api/emission-factors/health"], (req, res) => res.json({ ok: true, service: "emission-factors-service" }));

app.listen(PORT, () => console.log(`[emission-factors-service] listening on :${PORT}`));