const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const meta = (await c.query("select current_database() db, current_user usr, current_schema() sch")).rows[0];
  const sp   = (await c.query("show search_path")).rows[0];
  const reg  = (await c.query(
    "select to_regclass('assessment_responses') as ar_default, " +
    "       to_regclass('public.assessment_responses') as ar_public"
  )).rows[0];
  const idx  = (await c.query(
    "select indexname, indexdef from pg_indexes " +
    "where schemaname = current_schema() and tablename = 'assessment_responses' " +
    "order by 1"
  )).rows;
  console.log({ env: process.env.DATABASE_URL, meta, sp, reg, idx });
  await c.end();
})();
