import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();
const port = config.port;
const host = config.host;

app.listen({ port, host })
  .then(() => console.log(`[boot] ${config.serviceName} listening on http://${host}:${port}`))
  .catch((err) => { console.error('[boot] failed to start', err); process.exit(1); });

const signals: NodeJS.Signals[] = ['SIGINT','SIGTERM'];
for (const s of signals) {
  process.on(s, async () => {
    try { await app.close(); } finally { process.exit(0); }
  });
}
