import { Router } from "express";
import os from "os";

export function healthRouter(
  serviceName = process.env.SERVICE_NAME || "report-compiler-service"
) {
  const router = Router();
  const started = Date.now();

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: serviceName,
      version:
        process.env.npm_package_version ||
        process.env.SERVICE_VERSION ||
        "0.0.0",
      uptime_s: Math.floor((Date.now() - started) / 1000),
      host: os.hostname(),
    });
  });

  router.get("/ready", (_req, res) => {
    // add deeper checks here if you need (queue/db/etc)
    res.json({ ok: true, service: serviceName });
  });

  router.get("/routes", (_req, res) => {
    res.json({
      ok: true,
      service: serviceName,
      base: "/",
      routes: ["/health", "/ready", "/routes", "/status/:artifactId"],
    });
  });

  // Optional: quick status poll stub (Stage-1 friendly)
  router.get("/status/:artifactId", (req, res) => {
    const id = req.params.artifactId;
    if (!id || !/^[A-Za-z0-9._-]{1,200}$/.test(id)) {
      return res.status(400).json({ ok: false, error: "invalid_artifact_id" });
    }
    // If you emit job state somewhere, read it here; for S1 return basic stub
    return res.json({ ok: true, artifactId: id, state: "unknown" });
  });

  return router;
}
