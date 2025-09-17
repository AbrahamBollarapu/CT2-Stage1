import fs from "node:fs";

const f = "/app/server.mjs";
const s0 = fs.readFileSync(f, "utf8");
let s = s0.replace(/\r\n/g, "\n");

// Only insert if missing
if (!/app\.post\\('\/suppliers\/:sid\/responses'/.test(s)) {
  const marker = "app.get('/suppliers/:sid/score'";
  const i = s.indexOf(marker);
  if (i === -1) {
    console.error("Could not find score route marker; aborting without changes.");
    process.exit(2);
  }

  const route = `
  // Upsert responses
  app.post('/suppliers/:sid/responses', async (req) => {
    const { sid } = req.params || {};
    const { org_id, assessment_id, responses } = req.body || {};
    need(org_id, 'org_id'); need(assessment_id, 'assessment_id');

    // Upsert assessment_responses using column-list conflict (stable even if constraint names differ)
    await pool.query(
      \`INSERT INTO public.assessment_responses (org_id, supplier_id, assessment_id, responses)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (org_id, supplier_id, assessment_id)
         DO UPDATE SET responses = EXCLUDED.responses\`,
      [org_id, sid, assessment_id, responses]
    );

    // Read assessment schema (quoted JSON column)
    const sch = await pool.query(\`SELECT "schema" FROM public.assessments WHERE id = $1\`, [assessment_id]);
    const schema = sch.rows[0]?.schema || {};
    const weights = Object.fromEntries((schema.questions || []).map(q => [q.id, q.weight || 0]));

    // Score = sum(weights) where answer === true
    let score = 0;
    for (const [qid, ans] of Object.entries(responses || {})) {
      if (ans === true) score += (weights[qid] || 0);
    }

    // Ensure supplier_assessments row exists; then update score
    const sa = await pool.query(
      \`INSERT INTO public.supplier_assessments (org_id, supplier_id, assessment_id, status)
         VALUES ($1,$2,$3,'assigned')
         ON CONFLICT (org_id, supplier_id, assessment_id) DO NOTHING
         RETURNING id\`,
      [org_id, sid, assessment_id]
    );
    const saId = sa.rows[0]?.id ?? (await pool.query(
      \`SELECT id FROM public.supplier_assessments WHERE supplier_id=$1 AND assessment_id=$2\`,
      [sid, assessment_id]
    )).rows[0]?.id;

    if (saId) {
      await pool.query(
        \`UPDATE public.supplier_assessments
            SET status='scored', score=$1, submitted_at=now(), updated_at=now()
          WHERE id=$2\`,
        [score, saId]
      );
    }

    return { status: 'ok', score };
  });
`;

  s = s.slice(0, i) + route + s.slice(i);
}

// Also normalize a couple of safe SQL rewrites (idempotent)
s = s.replace(/SELECT\\s+schema\\s+FROM\\s+assessments/gi, 'SELECT "schema" FROM public.assessments');

if (s !== s0) {
  fs.writeFileSync(f, s);
  console.log("Inserted responses route.");
} else {
  console.log("No changes needed.");
}
