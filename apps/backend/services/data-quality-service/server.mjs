// /app/server.mjs — data-quality-service (pure Node)
import { createServer } from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8000);
const PREFIX = (process.env.PREFIX || "/api/data-quality").replace(/\/+$/, "");

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
    return sendJSON(res, 200, { ok: true, service: "data-quality" });
  }

  // POST /checks (root + namespaced)
  if (req.method === "POST" && (p === "/checks" || p === `${PREFIX}/checks`)) {
    try {
      const b = await parseBody(req);
      const { org_id="demo", meter="grid_kwh", unit="kWh", from, to } = b || {};
      // Minimal happy-path response for demo
      return sendJSON(res, 200, {
        ok: true,
        inputs: { org_id, meter, unit, from, to },
        checks: [
          { name: "missing_data",  status: "ok" },
          { name: "outliers",      status: "ok" },
          { name: "unit_consistency", status: "ok" },
        ],
        heatmap: { overall: "green" }
      });
    } catch (e) {
      return sendJSON(res, 500, { ok:false, error:"dq_internal_error", details:String(e?.message||e) });
    }
  }

  return sendJSON(res, 404, { ok:false, error:"not_found", path:p });
});

server.listen(PORT, "0.0.0.0", () =>
  console.log(`[data-quality] listening :${PORT} (PREFIX=${PREFIX})`)
);
