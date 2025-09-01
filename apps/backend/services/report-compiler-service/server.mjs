import express from "express";

const app = express();
const PORT = parseInt(process.env.PORT || "8000", 10);
const NAME = process.env.SERVICE_NAME || "report-compiler-service";
const PREFIX = process.env.SERVICE_PREFIX || "/api/reports";

const r = express.Router();
r.get("/health", (_req, res) => res.json({ ok: true, service: NAME }));

app.use(PREFIX, r);
app.listen(PORT, "0.0.0.0", () => console.log(`[${NAME}] listening on ${PORT} (prefix=${PREFIX})`));
