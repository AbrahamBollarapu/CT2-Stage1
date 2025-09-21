import express from 'express';

const app = express();
const port = 8000;

app.use(express.json());

// Health check endpoint
app.get('/api/kpi/health', (req, res) => {
  res.json({ status: 'OK', message: 'KPI Service is healthy' });
});

// KPI computation endpoint
app.post('/api/kpi/compute', (req, res) => {
  const { org_id } = req.body;
  res.json({
    org_id,
    kpis: [
      { name: 'total_suppliers', value: 42 },
      { name: 'compliance_score', value: 85.5 }
    ],
    computed_at: new Date().toISOString()
  });
});

// Get KPI data
app.get('/api/kpi', (req, res) => {
  const { org_id } = req.query;
  res.json({
    org_id,
    kpis: [
      { name: 'total_suppliers', value: 42 },
      { name: 'compliance_score', value: 85.5 }
    ],
    updated_at: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(\KPI Service running on port \\);
});
