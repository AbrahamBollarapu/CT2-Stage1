// services/suppliers-service/server.mjs
import Fastify from 'fastify';
import pg from 'pg';

const f = Fastify({ logger: { level: 'info' } });

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';
const SERVICE_PREFIX = process.env.SERVICE_PREFIX || '/api';

// --- DB pool ---
const {
  PGHOST = 'evidence-db',
  PGPORT = '5432',
  PGUSER = 'postgres',
  PGPASSWORD = 'postgres',
  PGDATABASE = 'postgres',
} = process.env;

const pool = new pg.Pool({
  host: PGHOST,
  port: Number(PGPORT),
  user: PGUSER,
  password: PGPASSWORD,
  database: PGDATABASE,
  max: 5,
});

f.get('/health', async () => ({ ok: true, svc: 'suppliers-service' }));

// Mount API under SERVICE_PREFIX (default /api)
f.register(async (app) => {
  // NEW: edge health at /api/suppliers/health
  app.get('/suppliers/health', async () => ({
    ok: true, svc: 'suppliers-service', prefix: `${SERVICE_PREFIX}/suppliers`
  }));

  // list suppliers
  app.get('/suppliers', async (req, reply) => {
    const org_id = req.query?.org_id;
    if (!org_id) return reply.code(400).send({ ok: false, error: 'org_id required' });
    const { rows } = await pool.query(
      'SELECT id, org_id, name, country, created_at FROM public.suppliers WHERE org_id=$1 ORDER BY id',
      [org_id]
    );
    return rows;
  });

  // optional: route map
  app.get('/_routes', async (req, reply) => {
    reply.type('text/plain').send(app.printRoutes());
  });
}, { prefix: SERVICE_PREFIX });

f.listen({ port: PORT, host: HOST })
  .then(() => f.log.info(`suppliers-service on http://${HOST}:${PORT}${SERVICE_PREFIX}`))
  .catch((err) => { f.log.error(err); process.exit(1); });
