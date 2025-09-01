// C4 seed routes for time-series-service
export function registerSeed(app:any) {
  const store:any = (globalThis as any).__TS ?? new Map();
  (globalThis as any).__TS = store;

  app.post("/seed-demo", async (_req:any, res:any) => {
    const key = "demo-2024Q4";
    if (!store.has(key)) {
      store.set(key, [
        { ts: "2024-10-01", v: 10 },
        { ts: "2024-11-01", v: 12 },
        { ts: "2024-12-01", v: 20 },
      ]);
    }
    res.json({ ok: true, seeded: true, id: key, points: (store.get(key)||[]).length });
  });

  app.get("/demo/series", (_req:any, res:any) => {
    res.json({ ok: true, series: (store.get("demo-2024Q4") || []) });
  });
}