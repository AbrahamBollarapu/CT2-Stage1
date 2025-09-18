// D:/CT2/apps/backend/services/jobs-service/server.mjs

import Fastify from 'fastify';
import process from 'node:process';

// ---------- config ----------
const PORT = Number(process.env.PORT || 8000);
const API_KEY = process.env.DEMO_API_KEY || 'ct2-dev-key';

// Accept either GW_BASE (single) or GW_BASES (comma-separated).
// Order matters: Traefik container name is most reliable for in-cluster calls.
const rawBases =
  (process.env.GW_BASES?.trim()) ||
  (process.env.GW_BASE?.trim()) ||
  'http://traefik:80,http://traefik-ct2-demo:80,http://localhost:8081';

const GW_BASES = rawBases.split(',').map(s => s.trim()).filter(Boolean);

// ---------- util ----------
const sleep = ms => new Promise(res => setTimeout(res, ms));

async function fetchJSON(url, { method = 'GET', body, headers = {}, timeoutMs = 10000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort('timeout'), timeoutMs);

  const hdrs = {
    'x-api-key': API_KEY,
    ...(body ? { 'content-type': 'application/json' } : {}),
    ...headers,
  };

  const resp = await fetch(url, { method, headers: hdrs, body, signal: ac.signal });
  clearTimeout(t);

  const text = await resp.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

  return { ok: resp.ok, status: resp.status, headers: Object.fromEntries(resp.headers), json };
}

async function tryBases(path, init, { timeoutMs = 10000 } = {}) {
  const attempts = [];
  for (const base of GW_BASES) {
    const url = base.replace(/\/+$/, '') + path;
    try {
      const r = await fetchJSON(url, { ...init, timeoutMs });
      attempts.push({ url, ok: r.ok, status: r.status, json: r.json });
      if (r.ok) return { ...r, url, attempts };
    } catch (err) {
      attempts.push({ url, ok: false, error: String(err) });
    }
  }
  const last = attempts[attempts.length - 1] || {};
  return { ok: false, status: last.status || 0, attempts, error: 'All bases failed' };
}

// ---------- app ----------
const app = Fastify({ logger: false });

// Health
app.get('/api/jobs/health', async () => ({
  ok: true,
  service: 'jobs-service',
  ts: new Date().toISOString(),
  gw_bases: GW_BASES,
}));

// Demo orchestrator (MVP): just a KPI step for now
app.post('/api/jobs/run/demo', async (req, reply) => {
  const steps = [];
  const {
    org_id = 'demo',
    period = '2024Q4',
    template = 'truststrip',
    meter = 'grid_kwh',
    unit = 'kWh',
  } = req.body || {};

  // 1) KPI compute
  const kpiBody = JSON.stringify({ org_id, period, meter, unit });
  const kpi = await tryBases('/api/kpi/compute', { method: 'POST', body: kpiBody }, { timeoutMs: 12000 });

  steps.push({
    step: 'kpi.compute',
    ok: !!kpi.ok,
    status: kpi.status || 0,
    result: kpi.ok ? kpi.json : undefined,
    error: kpi.ok ? undefined : (kpi.error || kpi.json?.error || 'failed'),
    attempts: kpi.attempts,
  });

  if (!kpi.ok) {
    return reply.code(502).send({ ok: false, error: 'Build failed', status: 0, steps });
  }

  // (Future) 2) ESG, 3) DQ, 4) Reports — extend here.

  return {
    ok: true,
    status: 200,
    summary: { org_id, period, template, meter, unit },
    steps,
  };
});

// Simple direct health (no prefix) if you curl the container
app.get('/health', async () => ({
  ok: true,
  service: 'jobs-service',
  version: '0.1.0',
  prefix: '/api',
}));

// ---------- start ----------
app.listen({ host: '0.0.0.0', port: PORT })
  .then(() => {
    console.log(`jobs-service listening on http://0.0.0.0:${PORT}`);
    console.log(`GW_BASES = ${GW_BASES.join(' | ')}`);
  })
  .catch(err => {
    console.error('jobs-service failed to start:', err);
    process.exit(1);
  });
