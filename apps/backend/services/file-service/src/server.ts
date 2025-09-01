import { createApp } from './app';

const PORT = Number(process.env.PORT || 8000);
const SERVICE = process.env.SERVICE_NAME || 'service';

const app = createApp(SERVICE);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[boot] ${SERVICE} listening on http://0.0.0.0:${PORT}`);
});
