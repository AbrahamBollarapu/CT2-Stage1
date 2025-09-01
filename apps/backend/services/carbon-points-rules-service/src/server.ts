import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();
const { host, port } = config;

app.listen({ port, host })
  .then(() => console.log(`[boot] ${config.serviceName} listening on http://${host}:${port}`))
  .catch((err) => { console.error('[boot] failed to start', err); process.exit(1); });

for (const s of ['SIGINT','SIGTERM'] as const) {
  process.on(s, async () => { try { await app.close(); } finally { process.exit(0); } });
}
