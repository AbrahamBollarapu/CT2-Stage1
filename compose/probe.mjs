import { Client } from "pg";
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const org = "demo";
const sid = "11111111-1111-1111-1111-111111111111";
const aid = "00000000-0000-0000-0000-000000000001";

try {
  // AR upsert (must use AR constraint)
  let r = await c.query(
    `INSERT INTO public.assessment_responses (org_id, supplier_id, assessment_id, responses)
     VALUES ($1,$2,$3,$4::jsonb)
     ON CONFLICT ON CONSTRAINT assessment_responses_org_sup_assess_uniq
     DO UPDATE SET responses = EXCLUDED.responses
     RETURNING (xmax=0) AS inserted`,
    [org, sid, aid, JSON.stringify({ q1:true, q2:false })]
  );
  console.log("AR upsert #1:", r.rows);

  // Ensure SA row exists (must use SA constraint)
  r = await c.query(
    `INSERT INTO public.supplier_assessments (org_id, supplier_id, assessment_id, status)
     VALUES ($1,$2,$3,'assigned')
     ON CONFLICT ON CONSTRAINT supplier_assessments_org_sup_assess_uniq DO NOTHING
     RETURNING id`,
    [org, sid, aid]
  );
  console.log("SA ensure:", r.rows);

  // Read schema (quoted+qualified)
  r = await c.query(`SELECT "schema" FROM public.assessments WHERE id = $1`, [aid]);
  console.log('schema keys:', Object.keys(r.rows[0]?.schema || {}));
} finally { await c.end(); }
