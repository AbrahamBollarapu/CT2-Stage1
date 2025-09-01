import type { FastifyInstance } from 'fastify';
import type { ServiceConfig } from './config.js';

export function registerRoutes(app: FastifyInstance, cfg: ServiceConfig) {
  app.get('/', async () => ({ service: cfg.serviceName, ok: true }));
  // add endpoints like /validate, /export as needed
}
