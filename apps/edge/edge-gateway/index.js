// Minimal edge gateway: subscribes to MQTT and/or simulates,
// batches points, posts to /api/time-series/points, and serves /health.
import http from "node:http";
import crypto from "node:crypto";
import { connect } from "mqtt";

const env = (k, d) => process.env[k] ?? d;

const API_BASE = env("API_BASE", "http://traefik:8081");
const API_KEY  = env("API_KEY", "ct2-dev-key");
const ORG_ID   = env("ORG_ID", "test-org");
const METER    = env("METER", "throughput");
const UNIT     = env("UNIT", "count");
const MQTT_URL = env("MQTT_URL", "mqtt://mosquitto:1883");
const DEVICE_ID = env("DEVICE_ID", "demo-edge-001");
const POST_INTERVAL_MS = +env("POST_INTERVAL_MS", "5000");
const SIM_INTERVAL_MS  = +env("SIM_INTERVAL_MS",  "5000");
const ENABLE_SIM = env("ENABLE_SIM", "true") === "true";

const buf = [];
let lastPostAt = null;
let mqttConnected = false;

// MQTT (optional)
let client = null;
try {
  client = connect(MQTT_URL, { reconnectPeriod: 2000 });
  client.on("connect", () => { mqttConnected = true; client.subscribe("sensors/+/throughput"); });
  client.on("close",   () => { mqttConnected = false; });
  client.on("message", (_topic, payload) => {
    try {
      const msg = JSON.parse(payload.toString());
      const ts = msg.ts ? new Date(msg.ts).toISOString() : new Date().toISOString();
      if (Number.isFinite(msg.value)) {
        buf.push({ ts, value: Number(msg.value) });
      }
    } catch {}
  });
} catch {}

// Simulator (if enabled)
if (ENABLE_SIM) {
  setInterval(() => {
    const value = 10 + Math.floor(Math.random() * 10); // 10..19
    buf.push({ ts: new Date().toISOString(), value });
  }, SIM_INTERVAL_MS);
}

// Batch poster
async function flush() {
  if (buf.length === 0) return;
  const batch = buf.splice(0, buf.length);
  const body = { org_id: ORG_ID, meter: METER, unit: UNIT, points: batch };
  const idem = crypto.createHash("sha256")
    .update(DEVICE_ID + ":" + (batch[0]?.ts ?? Date.now()))
    .digest("hex");
  try {
    const r = await fetch(\\/api/time-series/points\, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "x-idempotency-key": idem
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error("post_failed_"+r.status);
    lastPostAt = new Date().toISOString();
  } catch (e) {
    batch.forEach(p => buf.unshift(p));
    await new Promise(res => setTimeout(res, 1500));
  }
}
setInterval(flush, POST_INTERVAL_MS);

// Tiny /health
const server = http.createServer((_req, res) => {
  if (_req.url === "/health") {
    const body = JSON.stringify({
      ok: true,
      device: DEVICE_ID,
      mqtt: mqttConnected,
      buffered: buf.length,
      lastPostAt
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(body);
  } else {
    res.writeHead(404); res.end();
  }
});
server.listen(8001, () => console.log("edge-gateway health on :8001"));
