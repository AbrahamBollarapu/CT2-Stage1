const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    const r = await c.query(
      "INSERT INTO assessment_responses (org_id, supplier_id, assessment_id, responses) " +
      "VALUES ($1,$2,$3,$4::jsonb) " +
      "ON CONFLICT (supplier_id, assessment_id) " +
      "DO UPDATE SET responses = EXCLUDED.responses " +
      "RETURNING (xmax=0) AS inserted",
      ["demo",
       "11111111-1111-1111-1111-111111111111",
       "00000000-0000-0000-0000-000000000001",
       JSON.stringify({ q1:true, q2:false })]
    );
    console.log("OK:", r.rows);
  } catch (e) {
    console.error("ERROR:", e.code, e.message);
  } finally {
    await c.end();
  }
})();
