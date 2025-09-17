import express from "express";
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8000;

app.get(["/health", "/api/time-series/health"], (req, res) => res.json({ ok: true, service: "time-series-service" }));

app.listen(PORT, () => console.log(`[time-series-service] listening on :${PORT}`));