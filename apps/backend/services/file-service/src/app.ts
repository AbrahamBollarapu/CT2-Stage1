import express from 'express';

export function createApp(serviceName = process.env.SERVICE_NAME || 'service') {
  const app = express();
  const PORT = Number(process.env.PORT || 8000);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: serviceName,
      port: PORT,
      time: new Date().toISOString(),
    });
  });

  app.get('/', (_req, res) => res.send('ok'));

  return app;
}
