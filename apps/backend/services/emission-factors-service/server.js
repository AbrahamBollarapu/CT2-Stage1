import express from 'express';
import { traceMiddleware } from '../_shared/express-trace.js';

const app = express();
app.use(traceMiddleware); // <-- tracing
const PORT = process.env.PORT || 8000;

const FACTORS = {
  'grid_kwh:kWh': 0.82 // demo factor
};

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/api/emission-factors', (req, res) => {
  const key = `${req.query.meter}:${req.query.unit}`;
  res.json({ meter: req.query.meter, unit: req.query.unit, factor: FACTORS[key] ?? 1.0 });
});

app.listen(PORT, () => console.log('emf listening', PORT));
