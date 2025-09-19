import express from "express";

const app = express();
const PORT = process.env.PORT || 8000;

const page = (title, body) => `<!doctype html>
<html>
  <head><meta charset="utf-8"/><title>${title}</title></head>
  <body style="font-family:ui-sans-serif,system-ui,Segoe UI,Arial">
    <h1>${title}</h1>
    ${body}
  </body>
</html>`;

// health
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "dashboards-service", ts: new Date().toISOString() });
});

// demo routes
app.get("/", (_req, res) => res.send(page("CT2 Demo", `<a href="/dashboard">Go to Dashboard</a>`)));
app.get("/dashboard", (_req, res) => res.send(page("Dashboard", `<a href="/evidence/1">Sample evidence</a>`)));
app.get("/evidence/:id", (req, res) =>
  res.send(page(`Evidence ${req.params.id}`, `<a href="/dashboard">Back</a>`))
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[dashboards-service] listening on 0.0.0.0:${PORT}`);
});
