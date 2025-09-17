// /app/server.mjs — kpi-calculation-service (pure Node)
import { createServer } from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8000);
const PREFIX = (process.env.PREFIX || "/api/kpi").replace(/\/+$/, "");

function sendJSON(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(body.length),
  });
  res.end(body);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;

  // Health (root + namespaced)
  if (req.method === "GET" && (p === "/health" || p === `${PREFIX}/health`)) {
    return sendJSON(res, 200, { ok: true, service: "kpi" });
  }

  // GET /energy (root + namespaced) — demo stub returning 200
  if (req.method === "GET" && (p === "/energy" || p === `${PREFIX}/energy`)) {
    const org_id = url.searchParams.get("org_id") || "demo";
    const meter  = url.searchParams.get("meter")  || "grid_kwh";
    const unit   = url.searchParams.get("unit")   || "kWh";
    const from   = url.searchParams.get("from")   || "";
    const to     = url.searchParams.get("to")     || "";
    return sendJSON(res, 200, {
      ok: true,
      org_id, meter, unit, from, to,
      totals: { energy_kWh: 239.3 } // just a stub value for demo
    });
  }

  return sendJSON(res, 404, { ok:false, error:"not_found", path:p });
});

server.listen(PORT, "0.0.0.0", () =>
  console.log(`[kpi] listening :${PORT} (PREFIX=${PREFIX})`)
);
