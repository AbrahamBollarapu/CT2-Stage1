import express from 'express';
const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'dashboards' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('[dashboards-service] listening on 0.0.0.0:' + PORT);
});
