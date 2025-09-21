import Fastify from 'fastify';

const VERSION = '0.1.0';
const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';
const API_KEY = process.env.API_KEY || 'ct2-dev-key';

function normPrefix(p) {
  let x = p || '/api';
  if (!x.startsWith('/')) x = '/' + x;
  if (x.length > 1 && x.endsWith('/')) x = x.slice(0, -1);
  return x;
}
const SERVICE_PREFIX = normPrefix(process.env.SERVICE_PREFIX);

const f = Fastify({ logger: { level: 'info' } });

f.get('/health', async () => ({
  ok: true, service: 'kpi-calculation-service', version: VERSION, prefix: SERVICE_PREFIX,
}));

f.addHook('onRequest', async (req, reply) => {
  if (req.method !== 'GET') {
    const k = req.headers['x-api-key'];
    if (!k || k !== API_KEY) return reply.code(401).send({ error: 'unauthorized' });
  }
});

f.register(async (app) => {
  app.get('/kpi/health', async () => ({
    ok: true, svc: 'kpi-calculation-service', prefix: SERVICE_PREFIX
  }));

  app.get('/kpi', async (req) => {
    const org_id = req.query?.org_id || req.headers['x-org-id'] || 'demo';
    return [
      { id: 'kpi.energy.intensity', org_id, status: 'ok', updated_at: new Date().toISOString() },
      { id: 'kpi.emissions.scope2.location', org_id, status: 'ok', updated_at: new Date().toISOString() },
    ];
  });

  app.post('/kpi/compute', async (req) => {
    const org_id = req.body?.org_id || req.headers['x-org-id'] || 'demo';
    return { ok: true, org_id, computed: ['kpi.energy.intensity', 'kpi.emissions.scope2.location'] };
  });

  app.get('/_routes', async (req, reply) => {
    reply.type('text/plain').send(app.printRoutes());
  });
}, { prefix: SERVICE_PREFIX });

f.listen({ port: PORT, host: HOST })
  .then(() => f.log.info(`kpi-calculation-service listening on http://${HOST}:${PORT}${SERVICE_PREFIX}`))
  .catch((err) => { f.log.error(err); process.exit(1); });
