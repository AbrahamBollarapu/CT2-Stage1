import Fastify, { type FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';
import { config } from './config.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });
  app.get('/health', async () => ({ status: 'ok' }));
  registerRoutes(app, config);
  return app;
}
