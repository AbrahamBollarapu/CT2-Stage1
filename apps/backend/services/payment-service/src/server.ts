import express from 'express';

const app = express();
const PORT = Number(process.env.PORT || 8000);
const SERVICE = process.env.SERVICE_NAME || 'payment-service';

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE, port: PORT, time: new Date().toISOString() });
});

app.get('/', (_req, res) => res.send(\\ up\));

app.listen(PORT, '0.0.0.0', () => {
  console.log(\[\] listening on 0.0.0.0:\\);
});
