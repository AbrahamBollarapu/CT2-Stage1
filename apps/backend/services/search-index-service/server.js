import express from 'express';
import { traceMiddleware } from '../_shared/express-trace.js';

const app = express();
app.use(express.json());
app.use(traceMiddleware); // <-- tracing

const IDX = new Map(); // in-memory MVP

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/api/search/index', (req, res) => {
  const { id, attrs } = req.body || {};
  IDX.set(id, attrs);
  res.json({ ok: true });
});

app.get('/api/search', (req, res) => {
  const q = (req.query.q||'').toLowerCase();
  const hits = [...IDX.entries()]
    .filter(([id, a]) => JSON.stringify(a).toLowerCase().includes(q))
    .map(([id,a])=>({id,attrs:a}));
  res.json({ hits });
});

app.listen(process.env.PORT||8000, ()=>console.log('search listening'));
