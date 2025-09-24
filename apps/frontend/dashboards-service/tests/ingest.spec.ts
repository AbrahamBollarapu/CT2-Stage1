import { test, expect } from "@playwright/test";

/**
 * Robust backend smoke (edge-only writes):
 * - Finds base (8081 → 8085)
 * - Writes via EDGE using both request shapes:
 *    A) single point (ids in query):  /api/edge/ingest?org_id=..&metric=..&unit=..&meter=..
 *    B) wrapped batch in body:       { org_id, metric, meter, unit, points:[...] }
 * - Reads back from /api/time-series/points using a matrix of query variants:
 *    meter vs meter_id, with unit vs without unit
 * - Polls briefly; passes as soon as ANY variant returns ≥2 points
 */
test("Edge ingest → Time-Series read (robust, edge-only)", async ({ request }) => {
  // 1) Discover base
  const bases = ["http://localhost:8081", "http://localhost:8085"];
  let base = "";
  for (const b of bases) {
    try {
      const r = await request.get(b, { timeout: 2500 });
      if (r.ok()) { base = b; break; }
    } catch { /* try next */ }
  }
  expect(base, `No base reachable from ${bases.join(", ")}`).toBeTruthy();

  // 2) Test data (timestamps skew-safe: 30s..25s ago)
  const org_id = "test-org";
  const metric = "grid_kwh";
  const unit   = "kwh";
  const meter  = "meter-001";

  const now = Date.now();
  const p1 = { ts: new Date(now - 30_000).toISOString(), value: 2.31 };
  const p2 = { ts: new Date(now - 25_000).toISOString(), value: 2.37 };

  // 3A) Edge write — single point, ids in query
  const edgeSingleURL = `${base}/api/edge/ingest?` + new URLSearchParams({
    org_id, metric, unit, meter,
  }).toString();
  const w1 = await request.post(edgeSingleURL, {
    data: p1,
    headers: { "Content-Type": "application/json" },
  });
  const w1t = await w1.text();
  expect(w1.ok(), `EDGE single POST failed: ${w1.status()} ${w1t}`).toBeTruthy();

  // 3B) Edge write — wrapped batch in body
  const edgeBatchURL = `${base}/api/edge/ingest`;
  const w2 = await request.post(edgeBatchURL, {
    data: { org_id, metric, meter, unit, points: [p1, p2] },
    headers: { "Content-Type": "application/json" },
  });
  const w2t = await w2.text();
  expect(w2.ok(), `EDGE batch POST failed: ${w2.status()} ${w2t}`).toBeTruthy();

  // 4) Read variants (meter vs meter_id, with unit vs without unit)
  const from = new Date(now - 10 * 60_000).toISOString(); // 10m ago
  const to   = new Date(now + 3 * 60_000).toISOString();  // +3m (skew safe)
  const readVariants = [
    { label: "meter+unit",         qp: { org_id, metric, meter, unit, from, to } },
    { label: "meter no unit",      qp: { org_id, metric, meter,        from, to } },
    { label: "meter_id+unit",      qp: { org_id, metric, meter_id: meter, unit, from, to } as any },
    { label: "meter_id no unit",   qp: { org_id, metric, meter_id: meter,        from, to } as any },
  ];

  type Attempt = { label: string; url: string; status: number; body: string; count: number; };
  const attempts: Attempt[] = [];

  const extract = (body: any): any[] => {
    if (Array.isArray(body)) return body;
    if (body && Array.isArray(body.points)) return body.points;
    if (body && Array.isArray(body.data)) return body.data;
    if (body && body.result && Array.isArray(body.result.points)) return body.result.points;
    if (body && body.series && Array.isArray(body.series) && body.series[0] && Array.isArray(body.series[0].points)) {
      return body.series[0].points;
    }
    return [];
  };

  // 5) Poll up to ~20s until any variant sees ≥2 points
  const deadline = Date.now() + 20_000;
  let success = false;
  while (Date.now() < deadline && !success) {
    for (const v of readVariants) {
      const url = `${base}/api/time-series/points?${new URLSearchParams(v.qp as any).toString()}`;
      const resp = await request.get(url);
      const txt = await resp.text();
      let arr: any[] = [];
      try { const json = JSON.parse(txt); arr = extract(json); } catch {}
      const count = Array.isArray(arr) ? arr.length : 0;

      // track latest snapshot per variant
      const idx = attempts.findIndex(a => a.label === v.label);
      const rec: Attempt = { label: v.label, url, status: resp.status(), body: txt.slice(0, 280), count };
      if (idx >= 0) attempts[idx] = rec; else attempts.push(rec);

      if (resp.ok() && count >= 2) { success = true; break; }
    }
    if (!success) await new Promise(r => setTimeout(r, 800));
  }

  if (!success) {
    const diag = attempts.map(a => `• ${a.label} [${a.status}] count=${a.count}\n  ${a.url}\n  ${a.body}`).join("\n\n");
    throw new Error("No read variant returned ≥2 points.\n\nDiagnostics:\n" + diag);
  }

  expect(success).toBeTruthy();
});
