import express from "express";

const app = express();
app.use(express.json());

// health
app.get("/api/search/health", (_req, res) => res.json({ ok: true }));
app.get("/api/search/ready",  (_req, res) => res.json({ ok: true }));

// stub search
app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "").trim();
  const items: any[] = [];
  if (!q) {
    items.push({ kind: "hint", text: "Try 'report' or 'supplier policy'." });
  } else {
    items.push({ kind: "result", text: `You searched for: ${q}` });
    // Known demo evidence ids from earlier runs
    items.push({ kind: "evidence", id: "184cc1f7-2a7c-4294-b856-0fccc0798b86", title: "smoke.csv" });
    items.push({ kind: "evidence", id: "33fb4c21-e886-4f52-bf51-da09abf5c348", title: "supplier_policy.txt" });
  }
  res.json({ ok: true, items });
});

const PORT = Number(process.env.PORT || 8000);
app.listen(PORT, () => console.log("[search-service] listening on", PORT));
export default app;
