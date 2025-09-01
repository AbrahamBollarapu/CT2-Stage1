// Minimal HTTP mock for /health (no dependencies).
// Env: SERVICE_NAME, API_PREFIX, PORT, SERVICE_VERSION

import http from "http";
import os from "os";

const NAME = process.env.SERVICE_NAME || "mock";
const PORT = parseInt(process.env.PORT || "8000", 10);
const VERSION = process.env.SERVICE_VERSION || "0.0.1";

let PREFIX = process.env.API_PREFIX || `/api/${NAME}`;
if (!PREFIX.startsWith("/")) PREFIX = "/" + PREFIX;

const started = Date.now();

function send(res, code, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json", ...extraHeaders });
  res.end(body);
}

function is(pathname, subpath) {
  // Match with and without the API prefix
  return pathname === `${PREFIX}${subpath}` || pathname === subpath;
}

const server = http.createServer((req, res) => {
  const host = req.headers.host || "localhost";
  const { pathname } = new URL(req.url, `http://${host}`);

  if (is(pathname, "/health")) {
    return send(res, 200, {
      ok: true,
      service: NAME,
      version: VERSION,
      uptime_s: Math.floor((Date.now() - started) / 1000),
      host: os.hostname(),
      path: pathname
    });
  }

  if (is(pathname, "/ready")) {
    return send(res, 200, { ok: true, service: NAME, path: pathname });
  }

  if (is(pathname, "/routes")) {
    return send(res, 200, {
      ok: true,
      service: NAME,
      prefix: PREFIX,
      listen: `:${PORT}`,
      routes: [`${PREFIX}/health`, `${PREFIX}/ready`, `${PREFIX}/routes`, "/health", "/ready", "/routes"],
    });
  }

  return send(res, 404, {
    ok: false,
    error: "not_found",
    got: pathname,
    expected: [`${PREFIX}/health`, "/health"],
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[${NAME}] mock-health listening on ${PORT} prefix=${PREFIX}`);
});
