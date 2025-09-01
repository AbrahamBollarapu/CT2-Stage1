import type { FastifyInstance } from 'fastify';
import type { ServiceConfig } from './config.js';

// Keep this file free of app boot logic; do NOT import server.ts
export function registerRoutes(app: FastifyInstance, cfg: ServiceConfig) {
  // Example root route
  app.get('/', async () => ({ service: cfg.serviceName, ok: true }));

  // Example: /api/iam/** is routed here via Traefik StripPrefix
  app.get('/whoami', async () => ({ user: 'anonymous', scopes: [] }));
}
