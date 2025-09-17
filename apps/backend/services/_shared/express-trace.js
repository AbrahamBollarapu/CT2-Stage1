// _shared/express-trace.js
import crypto from "crypto";

/**
 * Express middleware:
 * - Read or generate W3C `traceparent` + `x-correlation-id`
 * - Echo them in response headers
 * - Log one line per request with timing
 * - Stash headers on req.traceHeaders for easy forwarding
 */
export function traceMiddleware(req, res, next) {
  const incoming = req.header("traceparent");
  const cid =
    req.header("x-correlation-id") ||
    (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36));

  const trace =
    incoming ||
    `00-${(Math.random().toString(16).slice(2)).padEnd(
      32,
      "0"
    )}-0000000000000000-01`;

  res.set("traceparent", trace);
  res.set("x-correlation-id", cid);

  // expose for outbound calls
  req.traceHeaders = { traceparent: trace, "x-correlation-id": cid };

  const t0 = Date.now();
  res.on("finish", () => {
    console.log(
      `[trace=${trace}] [corr=${cid}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - t0}ms`
    );
  });
  next();
}
