// D:\CT2\apps\frontend\src\lib\api.ts
const base = import.meta.env.VITE_API_BASE || '';
const apiKey = import.meta.env.VITE_API_KEY || 'ct2-dev-key';
const orgId = import.meta.env.VITE_ORG_ID || 'test-org';

const headers = {
  'x-api-key': apiKey,
  'Content-Type': 'application/json',
};

// --- API calls ---

// Suppliers
export async function fetchSuppliers() {
  const res = await fetch(`${base}/api/suppliers?org_id=${orgId}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Reports
export async function fetchReports() {
  const res = await fetch(`${base}/api/reports?org_id=${orgId}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Time-series
export async function fetchTimeSeries(meter = 'throughput', unit = 'count') {
  const from = new Date(Date.now() - 7 * 86400e3).toISOString();
  const to = new Date().toISOString();
  const url = `${base}/api/time-series/points?org_id=${orgId}&meter=${meter}&unit=${unit}&from=${from}&to=${to}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// --- Remove dashboard call (no backend endpoint exists) ---
