export async function postSample(value = 3.05) {
  const base   = import.meta.env.VITE_API_BASE || "";
  const org    = import.meta.env.VITE_CT2_ORG || "test-org";
  const meter  = import.meta.env.VITE_CT2_METER || "meter-001";
  const metric = import.meta.env.VITE_CT2_METRIC || "grid_kwh";
  const unit   = import.meta.env.VITE_CT2_UNIT || "kwh";
  const ts     = new Date(Date.now() - 10_000).toISOString(); // backdate 10s
  const url    = `${base}/api/edge/ingest?org_id=${org}&metric=${metric}&unit=${unit}&meter=${meter}`;
  const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ ts, value }) });
  if (!r.ok) throw new Error(`ingest failed ${r.status}`);
  window.dispatchEvent(new CustomEvent("EV_INGEST_TICK"));
}

export async function fetchPoints(minutes = 15) {
  const base   = import.meta.env.VITE_API_BASE || "";
  const org    = import.meta.env.VITE_CT2_ORG || "test-org";
  const meter  = import.meta.env.VITE_CT2_METER || "meter-001";
  const metric = import.meta.env.VITE_CT2_METRIC || "grid_kwh";
  const unit   = import.meta.env.VITE_CT2_UNIT || "kwh";
  const to   = new Date(Date.now() + 2*60*1000).toISOString();
  const from = new Date(Date.now() - minutes*60*1000).toISOString();
  const q = new URLSearchParams({ org_id: org, metric, unit, meter, from, to }).toString();
  const r = await fetch(`${base}/api/time-series/points?${q}`);
  if (!r.ok) throw new Error(`read failed ${r.status}`);
  return r.json() as Promise<{ ok: boolean, meter: string, unit: string, points: { ts: string, value: number }[] }>;
}
