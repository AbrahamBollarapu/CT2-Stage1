import Fastify from 'fastify';
import { Pool } from 'pg';

// bump when you ship
const VERSION = '0.3.3';

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

const pool = new Pool({
  host: process.env.PGHOST || 'evidence-db',
  user: process.env.PGUSER || 'evidence',
  password: process.env.PGPASSWORD || 'evidence',
  database: process.env.PGDATABASE || 'evidence',
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  max: 10,
});

const f = Fastify({ logger: { level: 'info' } });

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
    if (!k || k !== API_KEY) { reply.code(401); throw new Error('Unauthorized'); }
  }
});

// Mount all API routes under SERVICE_PREFIX
f.register(async (app) => {
  const need = (v, name) => {
    if (v === undefined || v === null || v === '') {
      const e = new Error(`Missing required field: ${name}`);
      e.statusCode = 400;
      throw e;
    }
  };

  // Debug: list routes we expose
  app.get('/_routes', async () => ([
    `GET ${SERVICE_PREFIX}/_routes`,
    `GET ${SERVICE_PREFIX}/suppliers?org_id=...`,
    `GET ${SERVICE_PREFIX}/assessments?org_id=...`,
    `POST ${SERVICE_PREFIX}/suppliers`,
    `POST ${SERVICE_PREFIX}/assessments`,
    `POST ${SERVICE_PREFIX}/suppliers/:sid/assign-assessment/:aid`,
    `POST ${SERVICE_PREFIX}/suppliers/:sid/responses`,
    `GET ${SERVICE_PREFIX}/suppliers/:sid/score?assessment_id=...`,
  ]));

  // Lists
  app.get('/suppliers', async (req) => {
    const { org_id } = req.query || {};
    need(org_id, 'org_id');
    const { rows } = await pool.query(
      `SELECT id, org_id, name, country, created_at
         FROM suppliers
        WHERE org_id = $1
        ORDER BY created_at DESC`,
      [org_id],
    );
    return rows;
  });

  app.get('/assessments', async (req) => {
    const { org_id } = req.query || {};
    need(org_id, 'org_id');
    const { rows } = await pool.query(
      `SELECT id, org_id, title, version, created_at
         FROM assessments
        WHERE org_id = $1
        ORDER BY created_at DESC`,
      [org_id],
    );
    return rows;
  });

  // Creates
  app.post('/suppliers', async (req) => {
    const { org_id, name, country } = req.body || {};
    need(org_id, 'org_id'); need(name, 'name');
    const { rows } = await pool.query(
      `INSERT INTO suppliers (org_id, name, country)
       VALUES ($1, $2, $3)
       RETURNING id, org_id, name, country, created_at`,
      [org_id, name, country || null],
    );
    return rows[0];
  });

  app.post('/assessments', async (req) => {
    const { org_id, title, version, schema } = req.body || {};
    need(org_id, 'org_id'); need(title, 'title'); need(version, 'version');
    const { rows } = await pool.query(
      `INSERT INTO assessments (org_id, title, version, schema)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, org_id, title, version, created_at`,
      [org_id, title, version, JSON.stringify(schema || {})],
    );
    return rows[0];
  });

  // Assign assessment to supplier
  app.post('/suppliers/:sid/assign-assessment/:aid', async (req) => {
    const { sid, aid } = req.params || {};
    const { org_id } = req.body || {};
    need(org_id, 'org_id');
    await pool.query(
      `INSERT INTO supplier_assessments (org_id, supplier_id, assessment_id, status)
       VALUES ($1, $2, $3, 'assigned')
       ON CONFLICT (supplier_id, assessment_id)
       DO UPDATE SET updated_at = now()`,
      [org_id, sid, aid],
    );
    return { status: 'assigned' };
  });

  // Submit responses + compute score
  app.post('/suppliers/:sid/responses', async (req) => {
    const { sid } = req.params || {};
    const { org_id, assessment_id, responses } = req.body || {};
    need(org_id, 'org_id'); need(assessment_id, 'assessment_id');

    await pool.query(
      `INSERT INTO assessment_responses (org_id, supplier_id, assessment_id, responses)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (supplier_id, assessment_id)
       DO UPDATE SET responses = EXCLUDED.responses`,
      [org_id, sid, assessment_id, JSON.stringify(responses || {})],
    );

    const a2 = await pool.query(`SELECT schema FROM assessments WHERE id = $1`, [assessment_id]);
    const schema = a2.rows[0]?.schema || {};
    const q = await pool.query(
      `SELECT responses FROM assessment_responses
        WHERE supplier_id = $1 AND assessment_id = $2`,
      [sid, assessment_id],
    );
    const answers = q.rows[0]?.responses || {};

    let total = 0, max = 0;
    for (const qu of (schema.questions || [])) {
      const w = Number(qu.weight || 0);
      max += w;
      if (answers[qu.id] === true) total += w;
    }
    const score = max ? Math.round((total / max) * 1000) / 10 : 0;

    const sa = await pool.query(
      `INSERT INTO supplier_assessments (org_id, supplier_id, assessment_id, status)
       VALUES ($1, $2, $3, 'assigned')
       ON CONFLICT (supplier_id, assessment_id) DO NOTHING
       RETURNING id`,
      [org_id, sid, assessment_id],
    );
    const saId = sa.rows[0]?.id ??
      (await pool.query(
        `SELECT id FROM supplier_assessments
          WHERE supplier_id = $1 AND assessment_id = $2`,
        [sid, assessment_id],
      )).rows[0]?.id;

    if (saId) {
      await pool.query(
        `UPDATE supplier_assessments
            SET status = 'scored',
                score = $1,
                submitted_at = now(),
                updated_at = now()
          WHERE id = $2`,
        [score, saId],
      );
    }
    return { status: 'ok', score };
  });

  // Read score
  app.get('/suppliers/:sid/score', async (req) => {
    const { sid } = req.params || {};
    const { assessment_id } = req.query || {};
    need(assessment_id, 'assessment_id');
    const a = await pool.query(
      `SELECT status, score
         FROM supplier_assessments
        WHERE supplier_id = $1 AND assessment_id = $2`,
      [sid, assessment_id],
    );
    return a.rows[0] || { status: 'not_found', score: 0 };
  });
}, { prefix: SERVICE_PREFIX });

f.listen({ port: PORT, host: HOST })
  .then(() => f.log.info(`suppliers-service listening on http://${HOST}:${PORT}${SERVICE_PREFIX}`))
  .catch((err) => { f.log.error(err); process.exit(1); });
