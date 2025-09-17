import Fastify from 'fastify';
import { Pool } from 'pg';

// bump when you ship
const VERSION = '0.4.1';

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';
const API_KEY = process.env.API_KEY || 'ct2-dev-key';

// normalize /api-like prefixes
function normPrefix(p) {
  let x = p || '/api';
  if (!x.startsWith('/')) x = '/' + x;
  if (x.length > 1 && x.endsWith('/')) x = x.slice(0, -1);
  return x;
}
const SERVICE_PREFIX = normPrefix(process.env.SERVICE_PREFIX);

// pg pool (defaults aligned to ct2; envs override)
const pool = new Pool({
  host: process.env.PGHOST || 'db',
  user: process.env.PGUSER || 'ct2',
  password: process.env.PGPASSWORD || 'ct2',
  database: process.env.PGDATABASE || 'ct2',
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  max: 10,
});

const f = Fastify({ logger: { level: 'info' } });

// graceful pool shutdown
f.addHook('onClose', async () => { try { await pool.end(); } catch {} });

// tiny helpers
const need = (v, name) => {
  if (v === undefined || v === null || v === '') {
    const e = new Error(`Missing required field: ${name}`);
    e.statusCode = 400;
    throw e;
  }
};
const getOrgId = (req) =>
  req.headers['x-org-id'] ||
  (req.query && req.query.org_id) ||
  (req.body && req.body.org_id);

// Unprefixed health for liveness probes
f.get('/health', async () => ({
  ok: true,
  service: 'suppliers-service',
  version: VERSION,
  prefix: SERVICE_PREFIX,
}));

// Require API key for non-GET verbs
f.addHook('onRequest', async (req, reply) => {
  if (req.method !== 'GET') {
    const k = req.headers['x-api-key'];
    if (!k || k !== API_KEY) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  }
});

// Mount all API routes under SERVICE_PREFIX
f.register(async (app) => {
  // Debug: list actual registered routes (text/plain)
  app.get('/_routes', async (req, reply) => {
    reply.type('text/plain').send(app.printRoutes());
  });

  // Lists
  app.get('/suppliers', async (req) => {
    const org_id = getOrgId(req); need(org_id, 'org_id');
    const { rows } = await pool.query(
      `SELECT id, org_id, name, country, created_at
         FROM public.suppliers
        WHERE org_id = $1
        ORDER BY created_at DESC`,
      [org_id],
    );
    return rows;
  });

  app.get('/assessments', async (req) => {
    const org_id = getOrgId(req); need(org_id, 'org_id');
    const { rows } = await pool.query(
      `SELECT id, org_id, title, version, created_at
         FROM public.assessments
        WHERE org_id = $1
        ORDER BY created_at DESC`,
      [org_id],
    );
    return rows;
  });

  // Creates
  app.post('/suppliers', async (req) => {
    const { name, country } = req.body || {};
    const org_id = getOrgId(req); need(org_id, 'org_id'); need(name, 'name');
    const { rows } = await pool.query(
      `INSERT INTO public.suppliers (org_id, name, country)
       VALUES ($1, $2, $3)
       RETURNING id, org_id, name, country, created_at`,
      [org_id, name, country || null],
    );
    return rows[0];
  });

  app.post('/assessments', async (req) => {
    const { title, version, schema } = req.body || {};
    const org_id = getOrgId(req); need(org_id, 'org_id'); need(title, 'title'); need(version, 'version');
    const { rows } = await pool.query(
      `INSERT INTO public.assessments (org_id, title, version, schema)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, org_id, title, version, created_at`,
      [org_id, title, version, JSON.stringify(schema || {})],
    );
    return rows[0];
  });

  // Assign assessment to supplier (CTE upsert: no unique needed)
  app.post('/suppliers/:sid/assign-assessment/:aid', async (req) => {
    const { sid, aid } = req.params || {};
    const org_id = getOrgId(req); need(org_id, 'org_id');

    await pool.query(
      `WITH up AS (
         UPDATE public.supplier_assessments s
            SET updated_at = now()
          WHERE s.org_id = $1 AND s.supplier_id = $2 AND s.assessment_id = $3
          RETURNING 1
       )
       INSERT INTO public.supplier_assessments (org_id, supplier_id, assessment_id, status)
       SELECT $1, $2, $3, 'assigned'
       WHERE NOT EXISTS (SELECT 1 FROM up)`,
      [org_id, sid, aid],
    );
    return { status: 'assigned' };
  });

  // Submit responses (inline scoring; CTE upserts; no trigger; no ON CONFLICT)
  app.post('/suppliers/:sid/responses', async (req) => {
    const { sid } = req.params || {};
    const { assessment_id, responses } = req.body || {};
    const org_id = getOrgId(req); need(org_id, 'org_id'); need(assessment_id, 'assessment_id');

    // 1) Upsert assessment_responses WITHOUT ON CONFLICT (CTE)
    await pool.query(
      `WITH up AS (
         UPDATE public.assessment_responses t
            SET responses = $4::jsonb
          WHERE t.org_id = $1 AND t.supplier_id = $2 AND t.assessment_id = $3
          RETURNING 1
       )
       INSERT INTO public.assessment_responses (org_id, supplier_id, assessment_id, responses)
       SELECT $1, $2, $3, $4::jsonb
       WHERE NOT EXISTS (SELECT 1 FROM up)`,
      [org_id, sid, assessment_id, JSON.stringify(responses || {})]
    );

    // 2) Fetch schema & compute weighted score (true adds weight)
    const sch = await pool.query(
      `SELECT "schema" FROM public.assessments WHERE id = $1`,
      [assessment_id]
    );
    const schema = sch.rows[0]?.schema || {};
    const weights = Object.fromEntries((schema.questions || []).map(q => [q.id, q.weight || 0]));

    let score = 0;
    for (const [qid, ans] of Object.entries(responses || {})) {
      if (ans === true) score += (weights[qid] || 0);
    }

    // 3) Ensure supplier_assessments row exists (CTE upsert), then set score+status
    const sa = await pool.query(
      `WITH up AS (
         UPDATE public.supplier_assessments s
            SET updated_at = now()
          WHERE s.org_id = $1 AND s.supplier_id = $2 AND s.assessment_id = $3
          RETURNING id
       ), ins AS (
         INSERT INTO public.supplier_assessments (org_id, supplier_id, assessment_id, status)
         SELECT $1, $2, $3, 'assigned'
         WHERE NOT EXISTS (SELECT 1 FROM up)
         RETURNING id
       )
       SELECT id FROM up
       UNION ALL
       SELECT id FROM ins`,
      [org_id, sid, assessment_id]
    );

    const saId = sa.rows[0]?.id ?? (await pool.query(
      `SELECT id FROM public.supplier_assessments
        WHERE org_id=$1 AND supplier_id=$2 AND assessment_id=$3`,
      [org_id, sid, assessment_id]
    )).rows[0]?.id;

    if (saId) {
      await pool.query(
        `UPDATE public.supplier_assessments
            SET status='scored', score=$1, submitted_at=now(), updated_at=now()
          WHERE id=$2`,
        [score, saId]
      );
    }

    return { status: 'ok', score };
  });

  // Read score (org-aware)
  app.get('/suppliers/:sid/score', async (req) => {
    const { sid } = req.params || {};
    const { assessment_id } = req.query || {};
    const org_id = getOrgId(req); need(org_id, 'org_id'); need(assessment_id, 'assessment_id');
    const a = await pool.query(
      `SELECT status, score
         FROM public.supplier_assessments
        WHERE org_id = $1 AND supplier_id = $2 AND assessment_id = $3`,
      [org_id, sid, assessment_id],
    );
    return a.rows[0] || { status: 'not_found', score: 0 };
  });
}, { prefix: SERVICE_PREFIX });

f.listen({ port: PORT, host: HOST })
  .then(() => f.log.info(`suppliers-service listening on http://${HOST}:${PORT}${SERVICE_PREFIX}`))
  .catch((err) => { f.log.error(err); process.exit(1); });
