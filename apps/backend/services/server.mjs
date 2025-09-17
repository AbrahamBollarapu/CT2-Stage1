import Fastify from 'fastify';
import pkg from './package.json' assert { type: 'json' };
import { Pool } from 'pg';

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';
const SERVICE_PREFIX = process.env.SERVICE_PREFIX || '/api';
const API_KEY = process.env.API_KEY || 'ct2-dev-key';

const pool = new Pool({
  host: process.env.PGHOST || 'evidence-db',
  user: process.env.PGUSER || 'evidence',
  password: process.env.PGPASSWORD || 'evidence',
  database: process.env.PGDATABASE || 'evidence',
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  max: 10,
});

const f = Fastify({ logger: true });

// Health
f.get('/health', async () => ({ ok: true, service: 'suppliers-service', version: pkg.version }));

// Simple DEV auth for mutating requests
f.addHook('onRequest', async (req, res) => {
  if (req.method !== 'GET') {
    const k = req.headers['x-api-key'];
    if (!k || k !== API_KEY) {
      res.code(401);
      throw new Error('Unauthorized');
    }
  }
});

// Wrap the API under SERVICE_PREFIX
f.register(async (app) => {

  // Helpers
  async function txRun(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // POST /suppliers
  app.post('/suppliers', async (req, reply) => {
    const { org_id, name, country } = req.body || {};
    if (!org_id || !name) { reply.code(400); return { ok:false, error:"org_id and name required" }; }
    const sql = `INSERT INTO suppliers(org_id,name,country) VALUES($1,$2,$3) RETURNING id,org_id,name,country,created_at`;
    const { rows } = await pool.query(sql, [org_id, name, country || null]);
    return rows[0];
  });

  // POST /assessments
  app.post('/assessments', async (req, reply) => {
    const { org_id, title, version, schema } = req.body || {};
    if (!org_id || !title || !version) { reply.code(400); return { ok:false, error:"org_id, title, version required" }; }
    const sql = `INSERT INTO assessments(org_id,title,version,schema) VALUES($1,$2,$3,$4) RETURNING id,org_id,title,version,created_at`;
    const { rows } = await pool.query(sql, [org_id, title, version, schema || null]);
    return rows[0];
  });

  // POST /suppliers/:sid/assign-assessment/:aid
  app.post('/suppliers/:sid/assign-assessment/:aid', async (req, reply) => {
    const { org_id } = req.body || {};
    const { sid, aid } = req.params || {};
    if (!org_id || !sid || !aid) { reply.code(400); return { ok:false, error:"org_id, supplier_id and assessment_id required" }; }
    const sql = `INSERT INTO supplier_assessments(org_id,supplier_id,assessment_id,status) VALUES($1,$2,$3,'assigned')
                 ON CONFLICT (supplier_id, assessment_id) DO UPDATE SET updated_at = now()
                 RETURNING id,status`;
    const { rows } = await pool.query(sql, [org_id, sid, aid]);
    return { ok:true, id: rows[0].id, status: rows[0].status };
  });

  // POST /suppliers/:sid/responses  -> stores responses and computes score
  app.post('/suppliers/:sid/responses', async (req, reply) => {
    const { org_id, assessment_id, responses } = req.body || {};
    const { sid } = req.params || {};
    if (!org_id || !sid || !assessment_id || !responses) {
      reply.code(400); return { ok:false, error:"org_id, assessment_id, responses required" };
    }
    return await txRun(async (client) => {
      // Ensure assignment exists
      const a1 = await client.query(
        `INSERT INTO supplier_assessments(org_id,supplier_id,assessment_id,status)
         VALUES($1,$2,$3,'assigned')
         ON CONFLICT (supplier_id, assessment_id) DO UPDATE SET updated_at = now()
         RETURNING id`, [org_id, sid, assessment_id]);
      const saId = a1.rows[0].id;

      // Insert responses
      await client.query(
        `INSERT INTO assessment_responses(org_id,supplier_assessment_id,responses) VALUES($1,$2,$3)`,
        [org_id, saId, responses]
      );

      // Fetch assessment schema to compute score
      const a2 = await client.query(`SELECT schema FROM assessments WHERE id=$1`, [assessment_id]);
      const schema = a2.rows[0]?.schema || {};
      const questions = Array.isArray(schema?.questions) ? schema.questions : [];
      const total = questions.reduce((acc, q) => acc + (Number(q.weight)||0), 0) || 0;
      let achieved = 0;
      for (const q of questions) {
        const w = Number(q.weight) || 0;
        const v = responses[q.id];
        if (v === true || v === 1 || v === 'true') achieved += w;
      }
      const score = total > 0 ? Math.round((achieved/total)*10000)/100 : 0;

      await client.query(
        `UPDATE supplier_assessments SET status='scored', score=$1, submitted_at=now(), updated_at=now() WHERE id=$2`,
        [score, saId]
      );

      return { ok:true, score };
    });
  });

  // GET /suppliers/:sid/score?assessment_id=...
  app.get('/suppliers/:sid/score', async (req, reply) => {
    const { sid } = req.params || {};
    const { assessment_id } = req.query || {};
    if (!sid || !assessment_id) { reply.code(400); return { ok:false, error:"supplier_id and assessment_id required" }; }
    const { rows } = await pool.query(
      `SELECT status, score FROM supplier_assessments WHERE supplier_id=$1 AND assessment_id=$2`,
      [sid, assessment_id]
    );
    if (!rows.length) { reply.code(404); return { ok:false, error:"not found" }; }
    return { ok:true, status: rows[0].status, score: rows[0].score };
  });

}, { prefix: SERVICE_PREFIX });

const start = async () => {
  try {
    await f.listen({ port: PORT, host: HOST });
    f.log.info(`suppliers-service listening on http://${HOST}:${PORT}${SERVICE_PREFIX}`);
  } catch (err) {
    f.log.error(err);
    process.exit(1);
  }
};

process.on('SIGINT', () => { f.close().finally(()=> process.exit(0)); });
process.on('SIGTERM', () => { f.close().finally(()=> process.exit(0)); });

start();
