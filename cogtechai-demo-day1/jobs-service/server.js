import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;

app.get(["/health", "/api/jobs/health"], (req, res) => res.json({ ok: true, service: "jobs-service" }));

app.post("/run/demo", (req, res) => {
  res.status(202).json({ accepted: true, job: "demo", status: "queued" });
});

app.post("/api/jobs/run/demo", (req, res) => {
  res.status(202).json({ accepted: true, job: "demo", status: "queued" });
});

app.listen(PORT, () => console.log(`[jobs-service] listening on :${PORT}`));