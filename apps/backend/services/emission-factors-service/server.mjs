// /app/server.mjs — emission-factors-service (pure Node)
import { createServer } from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8000);
const PREFIX = (process.env.PREFIX || "/api/emission-factors").replace(/\/+$/,"");

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
    return sendJSON(res, 200, { ok: true, service: "emission-factors" });
  }

  // Simple factor lookup: /factors?meter=grid_kwh&unit=kWh
  if (req.method === "GET" && (p === "/factors" || p === `${PREFIX}/factors`)) {
    const meter = url.searchParams.get("meter") || "grid_kwh";
    const unit  = url.searchParams.get("unit")  || "kWh";
    // hard-coded demo factor
    const factor = 0.82;
    return sendJSON(res, 200, {
      ok: true,
      meter, unit,
      factor, ef_unit: "kgCO2e/kWh",
      source: "static", version: "v1"
    });
  }

  sendJSON(res, 404, { ok: false, error: "not_found", path: p });
});

server.listen(PORT, "0.0.0.0", () =>
  console.log(`[emission-factors] listening :${PORT} (PREFIX=${PREFIX})`)
);
