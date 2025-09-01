import express from "express";

export function createApp() {
  const app = express();

  app.get("/health", (_req, res) => {
    const PORT = Number(process.env.PORT ?? 8000);
    const SERVICE = process.env.SERVICE_NAME ?? "service";
    res.json({ status: "ok", service: SERVICE, port: PORT, time: new Date().toISOString() });
  });

  app.get("/", (_req, res) => {
    res.send("up");
  });

  return app;
}
