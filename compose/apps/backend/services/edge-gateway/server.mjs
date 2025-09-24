import express from "express";
import bodyParser from "body-parser";
import mqtt from "mqtt";
import fetch from "node-fetch";

const PORT = process.env.PORT || 8001;
const API_KEY = process.env.API_KEY || "ct2-dev-key";
const MQTT_URL = process.env.MQTT_URL || "mqtt://mosquitto:1883";
const TS_BASE_URL = process.env.TS_BASE_URL || "http://time-series-service:8000";

const app = express();
app.use(bodyParser.json());

// Basic health
app.get("/health", (_req, res) => res.json({ ok: true, svc: "edge-gateway" }));

// Direct HTTP ingest for quick tests
app.post("/ingest", async (req, res) => {
  try {
    const { org_id, meter, unit, value, ts } = req.body || {};
    if (!org_id || !meter || !unit || value === undefined) {
      return res.status(400).json({ ok: false, error: "missing fields" });
    }
    const r = await fetch(`${TS_BASE_URL}/api/time-series/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify([{
        org_id, meter, unit, value,
        ts: ts || new Date().toISOString()
      }])
    });
    const j = await r.json().catch(() => ({}));
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, upstream: j });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// MQTT → time-series bridge
const client = mqtt.connect(MQTT_URL);
client.on("connect", () => {
  console.log("MQTT connected", MQTT_URL);
  client.subscribe("ct2/ingest/#", (err) => {
    if (err) console.error("subscribe error", err);
  });
});

client.on("message", async (_topic, payload) => {
  try {
    const data = JSON.parse(payload.toString());
    if (!data?.org_id || !data?.meter || !data?.unit || data.value === undefined) return;
    await fetch(`${TS_BASE_URL}/api/time-series/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify([{
        org_id: data.org_id,
        meter: data.meter,
        unit: data.unit,
        value: data.value,
        ts: data.ts || new Date().toISOString(),
      }])
    });
  } catch (e) {
    console.error("ingest error", e);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`edge-gateway listening on ${PORT}`);
});
