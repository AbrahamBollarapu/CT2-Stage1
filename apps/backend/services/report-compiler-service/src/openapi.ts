import type { Express, Request, Response } from "express";
export function registerOpenApi(app: Express, serviceName?: string) {
  const name = serviceName || process.env.SERVICE_NAME || (process as any).env?.npm_package_name || "service";
  app.get("/openapi.json", (_req: Request, res: Response) => {
    const doc = {
      openapi: "3.0.0",
      info: { title: name, version: "0.1.0" },
      paths: {
        "/health": { get: { summary: "Liveness", responses: { "200": { description: "OK" } } } },
        "/ready":  { get: { summary: "Readiness", responses: { "200": { description: "OK" } } } }
      },
      "x-service": name
    };
    res.json(doc);
  });
}