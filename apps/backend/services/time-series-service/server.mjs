// /app/server.mjs — time-series-service (robust inputs + ingest alias)
import { createServer } from "node:http";
import { URL } from "node:url";

const PORT      = Number(process.env.PORT || 8000);
const PREFIX    = (process.env.PREFIX || "/api/time-series").replace(/\/+$/, "");
const AUTH_MODE = (process.env.AUTH_MODE || "dev").toLowerCase();  // dev | none
const DEV_KEY   = process.env.DEV_KEY || "ct2-dev-key";

// key -> [{ts, value}]
const store = new Map(); // `${org_id}/${meter}/${unit}` -> array

// ---------- utils ----------
const sendJSON = (res, code, obj) => {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "content-length": String(body.length) });
  res.end(body);
};
const parseBody = req => new Promise((resolve, reject) => {
  const chunks = []; req.on("data", c => chunks.push(c));
  req.on("end", () => { if (!chunks.length) return resolve({}); try {
    resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (e) { reject(e); }});
  req.on("error", reject);
});
const eq = (p, a) => p === a || p === a + "/";
const okAuth = req => AUTH_MODE === "none" || (AUTH_MODE === "dev" && String(req.headers["x-api-key"] || "") === DEV_KEY);

function mergeInputs(url, body) {
  const q = Object.fromEntries(url.searchParams.entries());
  const out = {
    org_id: body.org_id || q.org_id || "demo",
    meter:  body.meter  || q.meter  || null,
    unit:   body.unit   || q.unit   || null,
    from:   body.from   || q.from   || null,
    to:     body.to     || q.to     || null,
    mode:  (body.mode   || q.mode   || "upsert").toLowerCase()
  };
  return out;
}
const keyOf = x => `${x.org_id}/${x.meter}/${x.unit}`;
const inRange = (tsISO, from, to) => {
  const t = Date.parse(tsISO); if (Number.isNaN(t)) return false;
  if (from && t < Date.parse(from + "T00:00:00Z")) return false;
  if (to   && t > Date.parse(to   + "T23:59:59Z")) return false;
  return true;
};
function normalizePoints(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(p => ({ ts: new Date(p.ts).toISOString(), value: Number(p.value) }))
            .filter(p => !Number.isNaN(Date.parse(p.ts)) && Number.isFinite(p.value));
}

// ---------- core ----------
function getPoints(inp) {
  const k = keyOf(inp); const all = store.get(k) || [];
  return (inp.from || inp.to) ? all.filter(p => inRange(p.ts, inp.from, inp.to)) : all;
}
function upsertPoints(inp, pts) {
  const k = keyOf(inp); const cur = store.get(k) || [];
  const idx = new Map(cur.map(p => [p.ts, p.value]));
  for (const p of pts) idx.set(p.ts, p.value);
  const merged = Array.from(idx, ([ts, value]) => ({ ts, value })).sort((a,b)=>a.ts.localeCompare(b.ts));
  store.set(k, merged); return merged.length;
}
function replacePoints(inp, pts) {
  const k = keyOf(inp); const cur = store.get(k) || [];
  const kept = (inp.from || inp.to) ? cur.filter(p => !inRange(p.ts, inp.from, inp.to)) : [];
  const merged = kept.concat(pts).sort((a,b)=>a.ts.localeCompare(b.ts));
  store.set(k, merged); return merged.length;
}

// ---------- server ----------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;

  // Health (root & namespaced)
  if (req.method === "GET" && (eq(p, "/health") || eq(p, `${PREFIX}/health`))) {
    return sendJSON(res, 200, { ok: true, service: "time-series" });
  }

  // GET /points (root & namespaced)
  if (req.method === "GET" && (eq(p, "/points") || eq(p, `${PREFIX}/points`))) {
    const inp = mergeInputs(url, {});
    if (!inp.meter || !inp.unit) return sendJSON(res, 400, { ok: false, error: "meter, unit required" });
    return sendJSON(res, 200, { ok: true, meter: inp.meter, unit: inp.unit, points: getPoints(inp) });
  }

  // POST /points (root & namespaced)
  if (req.method === "POST" && (eq(p, "/points") || eq(p, `${PREFIX}/points`))) {
    if (!okAuth(req)) return sendJSON(res, 401, { ok: false, error: "unauthorized" });
    try {
      const body = await parseBody(req);
      const inp = mergeInputs(url, body);
      const pts = normalizePoints(body?.points);
      if (!inp.meter || !inp.unit || !pts.length) {
        return sendJSON(res, 400, { ok: false, error: "meter, unit, points[] required" });
      }
      const total = inp.mode === "replace" ? replacePoints(inp, pts) : upsertPoints(inp, pts);
      return sendJSON(res, 200, { ok: true, mode: inp.mode, meter: inp.meter, unit: inp.unit, count: pts.length, total });
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: "bad_request", details: String(e?.message || e) });
    }
  }

  // POST /ingest (compat alias to POST /points)
  if (req.method === "POST" && (eq(p, "/ingest") || eq(p, `${PREFIX}/ingest`))) {
    if (!okAuth(req)) return sendJSON(res, 401, { ok: false, error: "unauthorized" });
    try {
      const body = await parseBody(req);
      const inp = mergeInputs(url, body);
      const pts = normalizePoints(body?.points);
      if (!inp.meter || !inp.unit || !pts.length) {
        return sendJSON(res, 400, { ok: false, error: "meter, unit, points[] required" });
      }
      const total = inp.mode === "replace" ? replacePoints(inp, pts) : upsertPoints(inp, pts);
      return sendJSON(res, 200, { ok: true, compat: "ingest", mode: inp.mode, meter: inp.meter, unit: inp.unit, count: pts.length, total });
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: "bad_request", details: String(e?.message || e) });
    }
  }

  // Fallback
  return sendJSON(res, 404, { ok: false, error: "not_found", path: p });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[time-series] :${PORT} (PREFIX=${PREFIX}, AUTH_MODE=${AUTH_MODE})`);
});
