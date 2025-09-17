import { Client } from "pg";
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const meta = (await c.query("select current_database() db, current_user usr, current_schema() sch")).rows[0];
const sp   = (await c.query("show search_path")).rows[0];
const cons = (await c.query(
  "select conname, pg_get_constraintdef(oid) def " +
  "from pg_constraint where conrelid='public.assessment_responses'::regclass and contype='u' order by 1"
)).rows;
console.log({ env: process.env.DATABASE_URL, meta, sp, cons });
await c.end();
