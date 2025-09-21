// public/api.js (example)
export async function getTimeSeries({ orgId = "test-org", metric = "demo.kwh", range = "1h" } = {}) {
  const res = await fetch(`/api/time-series/query?org_id=${encodeURIComponent(orgId)}&metric=${encodeURIComponent(metric)}&range=${encodeURIComponent(range)}`, {
    headers: { "x-api-key": "ct2-dev-key" }
  });
  if (!res.ok) throw new Error(`query failed: ${res.status}`);
  const data = await res.json();
  return data.points?.map(p => ({ ts: new Date(p.ts), value: p.value })) ?? [];
}

// Example usage (render a tiny inline table)
export async function renderMiniSeries(elId = "series") {
  const rows = await getTimeSeries({ orgId: "test-org", metric: "demo.kwh", range: "24h" });
  const el = document.getElementById(elId);
  if (!el) return;
  if (!rows.length) { el.innerHTML = "<em>No data</em>"; return; }
  el.innerHTML = `
    <table border="1" cellspacing="0" cellpadding="4">
      <thead><tr><th>Time</th><th>Value</th></tr></thead>
      <tbody>
        ${rows.slice(-20).map(r => `<tr><td>${r.ts.toISOString()}</td><td>${r.value}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}
