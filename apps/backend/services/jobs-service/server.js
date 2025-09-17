import express from 'express';
import axios from 'axios';
import { traceMiddleware } from '../_shared/express-trace.js';

const app = express();
app.use(express.json());
app.use(traceMiddleware); // <-- tracing

const { ESG_API, DQ_API, KPI_API } = process.env;

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/api/jobs/run', async (req, res) => {
  const { type, period, org_id, meter='grid_kwh', unit='kWh' } = { ...req.query, ...req.body };
  try {
    const headers = req.traceHeaders || {};
    const [esg, dq, kpi] = await Promise.all([
      axios.get(`${ESG_API}/api/esg/metrics`, { params: { meter, unit, period, org_id }, headers }),
      axios.get(`${DQ_API}/api/data-quality/heatmap`, { params: { meter, unit, from: `${period}-01`, to: `${period}-28`, org_id }, headers }),
      axios.get(`${KPI_API}/api/kpi/values`, { params: { meter, unit, period, org_id }, headers })
    ]);
    res.json({ ok: true, esg: esg.data, dq: dq.data, kpi: kpi.data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(process.env.PORT||8000, ()=>console.log('jobs listening'));
