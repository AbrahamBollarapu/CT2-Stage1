// C4 seed routes for emission-factors-service
export function registerSeed(app:any) {
  const store:any = (globalThis as any).__EMF ?? new Map();
  (globalThis as any).__EMF = store;

  app.post("/seed-demo", async (_req:any, res:any) => {
    if (!store.has("co2e.kg.per.kwh")) {
      store.set("co2e.kg.per.kwh", { key:"co2e.kg.per.kwh", value:0.45, unit:"kg/kWh", source:"demo" });
      store.set("ch4.g.per.m3",     { key:"ch4.g.per.m3",     value:0.8,  unit:"g/m3",  source:"demo" });
      store.set("n2o.g.per.l",      { key:"n2o.g.per.l",      value:0.3,  unit:"g/L",   source:"demo" });
    }
    res.json({ ok:true, seeded:true, count: store.size });
  });

  app.get("/factors/demo", (_req:any, res:any) => {
    res.json({ ok:true, factors: Array.from(store.values()) });
  });
}