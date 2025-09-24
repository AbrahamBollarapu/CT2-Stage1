// Express + MQTT edge: sim or MQTT -> batch -> POST /api/time-series/points, health at :8001
import express from "express";
import bodyParser from "body-parser";
import mqtt from "mqtt";
import crypto from "node:crypto";

// Helper to read env with default
const env = (k, d) => process.env[k] ?? d;

// --- Config (env-overridable) ---
const PORT = +(env("PORT", "8001"));
const API_BASE = env("API_BASE", "http://traefik:8081"); // Traefik DNS inside docker net
const API_KEY  = env("API_KEY", "ct2-dev-key");
const ORG_ID   = env("ORG_ID", "test-org");
const METER    = env("METER", "throughput");
const UNIT     = env("UNIT", "count");
const MQTT_URL = env("MQTT_URL", "mqtt://mosquitto:1883");
const DEVICE_ID = env("DEVICE_ID", "demo-edge-001");
const POST_INTERVAL_MS = +env("POST_INTERVAL_MS", "5000");
const SIM_INTERVAL_MS  = +env("SIM_INTERVAL_MS",  "5000");
const ENABLE_SIM = env("ENABLE_SIM", "true") === "true";

// --- State ---
const buf = []; // array of { ts: ISO, value: number }
let lastPostAt = null;
let mqttConnected = false;
const log = (...a) => console.log(new Date().toISOString(), "-", ...a);

// --- Express App (health + optional HTTP ingest) ---
const app = express();
app.use(bodyParser.json());

// Health endpoint (used by Traefik/compose healthcheck)
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    svc: "edge-gateway",
    device: DEVICE_ID,
    mqtt: mqttConnected,
    buffered: buf.length,
    lastPostAt,
    config: { org: ORG_ID, meter: METER, unit: UNIT, sim: ENABLE_SIM, post_ms: POST_INTERVAL_MS }
  });
});

// Flexible HTTP ingest (Traefik maps /api/edge/ingest -> /ingest)
// Accepts { points:[{ts,value}...] } OR { value, ts? } (ORG/METER/UNIT via env)
app.post("/ingest", async (req, res) => {
  try {
    const b = req.body || {};

    if (Array.isArray(b.points) && b.points.length) {
      let queued = 0;
      for (const p of b.points) {
        const v = Number(p?.value);
        if (Number.isFinite(v)) {
          buf.push({ ts: p.ts ? new Date(p.ts).toISOString() : new Date().toISOString(), value: v });
          queued++;
        }
      }
      return res.json({ ok: true, queued });
    }

    if (Number.isFinite(b.value)) {
      buf.push({ ts: b.ts ? new Date(b.ts).toISOString() : new Date().toISOString(), value: Number(b.value) });
      return res.json({ ok: true, queued: 1 });
    }

    return res.status(400).json({ ok: false, error: "expected { value } or { points:[{ts,value}] }" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// --- MQTT Bridge ---
// Supports two payload styles:
// 1) sensors/<deviceId>/throughput  -> { "value": 12, "ts"?: ISO }
// 2) ct2/ingest/#                   -> { org_id, meter, unit, value, ts? } (env defaults if missing)
try {
  const client = mqtt.connect(MQTT_URL, { reconnectPeriod: 2000 });

  client.on("connect", () => {
    mqttConnected = true;
    client.subscribe(["sensors/+/throughput", "ct2/ingest/#"], (err) => {
      if (err) console.error("MQTT subscribe error:", err);
    });
    log("MQTT connected", MQTT_URL);
  });

  client.on("close", () => { mqttConnected = false; log("MQTT disconnected"); });

  client.on("message", (topic, payload) => {
    try {
      const msg = JSON.parse(payload.toString());

      if (topic.startsWith("sensors/")) {
        const v = Number(msg?.value);
        if (Number.isFinite(v)) {
          const ts = msg.ts ? new Date(msg.ts).toISOString() : new Date().toISOString();
          buf.push({ ts, value: v });
        }
        return;
      }

      // ct2/ingest/# path
      const org = msg.org_id ?? ORG_ID;
      const meter = msg.meter ?? METER;
      const unit = msg.unit ?? UNIT;
      const v = Number(msg?.value);
      if (org === ORG_ID && meter === METER && unit === UNIT && Number.isFinite(v)) {
        const ts = msg.ts ? new Date(msg.ts).toISOString() : new Date().toISOString();
        buf.push({ ts, value: v });
      }
    } catch {
      // ignore malformed
    }
  });
} catch (e) {
  log("MQTT init error:", String(e));
}

// --- Simulator (if enabled) ---
if (ENABLE_SIM) {
  setInterval(() => {
    const value = 10 + Math.floor(Math.random() * 10); // 10..19
    buf.push({ ts: new Date().toISOString(), value });
  }, SIM_INTERVAL_MS);

  // Quick kickstart so demos don't wait
  setTimeout(() => {
    buf.push({ ts: new Date().toISOString(), value: 12 });
    log("Simulator kickstart point queued");
  }, 1200);
}

// --- Batch POST to /api/time-series/points ---
async function flush() {
  if (buf.length === 0) return;

  const batch = buf.splice(0, buf.length);
  const body = { org_id: ORG_ID, meter: METER, unit: UNIT, points: batch };

  // idempotency per window
  const idem = crypto.createHash("sha256").update(`${DEVICE_ID}:${batch[0]?.ts ?? Date.now()}`).digest("hex");

  const url = `${API_BASE}/api/time-series/points`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "x-idempotency-key": idem
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`POST ${url} -> ${r.status}; body=${text.slice(0,200)}`);
    }

    lastPostAt = new Date().toISOString();
    log(`Posted ${batch.length} point(s) -> ${METER}/${UNIT}; lastPostAt=${lastPostAt}`);
  } catch (e) {
    log("POST failed:", String(e));
    // Requeue and backoff
    while (batch.length) buf.unshift(batch.pop());
    await new Promise(res => setTimeout(res, 1500));
  }
}

setInterval(flush, POST_INTERVAL_MS);

// --- Start ---
app.listen(PORT, "0.0.0.0", () => {
  log(`edge-gateway listening on ${PORT}`);
  log("ENV", { API_BASE, ORG_ID, METER, UNIT, MQTT_URL, DEVICE_ID, ENABLE_SIM, POST_INTERVAL_MS, SIM_INTERVAL_MS });
});
