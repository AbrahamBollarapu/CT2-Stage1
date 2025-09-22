import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div style={{ padding: 48, fontFamily: 'Inter, system-ui', lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 32, margin: 0 }}>CT2</h1>
      <p style={{ marginTop: 8 }}>Supply KPIs and time-series dashboards.</p>
      <Link to="/app" style={{ display: 'inline-block', marginTop: 16 }}>
        Open demo →
      </Link>
    </div>
  );
}
