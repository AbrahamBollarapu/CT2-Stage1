// /app/server.mjs — esg-service (pure Node; minimal)
import { createServer } from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8000);
const PREFIX = (process.env.PREFIX || "/api/esg").replace(/\/+$/,"");

// factor fallback (if EF not called)
const DEFAULT_FACTOR = 0.82;

function sendJSON(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(body.length),
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve,reject)=>{
    const chunks=[]; req.on("data",(c)=>chunks.push(c));
    req.on("end",()=>{ try{ resolve(chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")):{}); }catch(e){ reject(e);} });
    req.on("error",reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;

  // Health (root + namespaced)
  if (req.method === "GET" && (p === "/health" || p === `${PREFIX}/health`)) {
    return sendJSON(res, 200, { ok: true, service: "esg" });
  }

  // POST /footprint (root + namespaced) — simple sum × factor
  if (req.method === "POST" && (p === "/footprint" || p === `${PREFIX}/footprint`)) {
    try {
      const b = await parseBody(req);
      const { org_id="demo", meter="grid_kwh", unit="kWh", from, to, points } = b || {};
      if (!org_id || !meter || !unit) return sendJSON(res, 400, { ok:false, error:"bad_request" });

      // If explicit points provided, use them; else call your time-series-service via gateway (omitted here for stub).
      const arr = Array.isArray(points) ? points : [];
      const energy = arr.reduce((s,p)=> s + Number(p.value||0), 0);
      const emissions = energy * DEFAULT_FACTOR;

      return sendJSON(res, 200, {
        ok: true,
        inputs: { org_id, meter, unit, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined },
        factor: { meter, unit, factor: DEFAULT_FACTOR, ef_unit:"kgCO2e/kWh", source:"static", version:"v1" },
        totals: { energy_kWh: energy, emissions_kgCO2e: emissions },
        points: arr.length
      });
    } catch(e) {
      return sendJSON(res, 500, { ok:false, error:"esg_internal_error", details:String(e?.message||e) });
    }
  }

  sendJSON(res, 404, { ok:false, error:"not_found", path:p });
});

server.listen(PORT, "0.0.0.0", () =>
  console.log(`[esg] listening :${PORT} (PREFIX=${PREFIX})`)
);
