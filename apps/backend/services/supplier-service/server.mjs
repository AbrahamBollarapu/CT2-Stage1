import Fastify from "fastify";
import cors from "@fastify/cors";
import pg from "pg";

const app = Fastify({ logger: false });

const PORT = process.env.PORT || 8000;
const API_KEY = process.env.API_KEY || "ct2-dev-key";
const {
  PGHOST = "evidence-db",
  PGPORT = "5432",
  PGUSER = "postgres",
  PGPASSWORD = "postgres",
  PGDATABASE = "evidence",
} = process.env;

const pool = new pg.Pool({
  host: PGHOST,
  port: Number(PGPORT),
  user: PGUSER,
  password: PGPASSWORD,
  database: PGDATABASE,
  max: 5,
  idleTimeoutMillis: 10_000,
});

await app.register(cors, { origin: false });

app.addHook("onRequest", async (req, reply) => {
  if (req.url === "/health") return;
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) reply.code(401).send({ error: "invalid api key" });
});

app.get("/health", async (_req, reply) => {
  try {
    const r = await pool.query("select 1 as ok");
    reply.send({ ok: true, db: r.rows?.[0]?.ok === 1, svc: "supplier-service" });
  } catch (e) {
    reply.code(500).send({ ok: false, error: String(e) });
  }
});

app.get("/api/suppliers", async (req, reply) => {
  const q = req.query ?? {};
  const org_id = q.org_id;
  const country = q.country;
  const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
  const page_size = Math.max(1, Math.min(100, parseInt(q.page_size ?? "25", 10) || 25));
  if (!org_id) return reply.code(400).send({ error: "org_id required" });

  const where = ["org_id = $1"];
  const args = [org_id];
  if (country) { where.push("country = $2"); args.push(country); }

  const sqlCount = `select count(*)::int as n from public.suppliers where ${where.join(" and ")}`;
  const sqlItems = `
    select id, org_id, name, country, created_at
    from public.suppliers
    where ${where.join(" and ")}
    order by id
    offset $${args.length + 1} limit $${args.length + 2};
  `;

  try {
    const [c, it] = await Promise.all([
      pool.query(sqlCount, args),
      pool.query(sqlItems, [...args, (page - 1) * page_size, page_size]),
    ]);
    reply.send({ count: c.rows[0].n, page, page_size, items: it.rows });
  } catch (e) {
    reply.code(500).send({ error: "db_error", detail: String(e) });
  }
});

app.get("/api/suppliers/:id", async (req, reply) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
  try {
    const r = await pool.query(
      "select id, org_id, name, country, created_at from public.suppliers where id = $1",
      [id]
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "not found" });
    reply.send(r.rows[0]);
  } catch (e) {
    reply.code(500).send({ error: "db_error", detail: String(e) });
  }
});

app.listen({ host: "0.0.0.0", port: Number(PORT) })
  .then(() => app.log.info(`supplier-service on :${PORT}`))
  .catch((err) => {
    console.error("Failed to start supplier-service:", err);
    process.exit(1);
  });
