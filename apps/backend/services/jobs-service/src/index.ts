import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "jobs" }));

app.post("/api/jobs/run/demo", async (_req, res) => {
  // For demo: pretend to orchestrate the happy path
  res.json({ ok: true, job: "demo", queuedAt: new Date().toISOString() });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`jobs-service on :${PORT}`));
