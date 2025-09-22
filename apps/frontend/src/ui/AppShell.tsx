import { Link, Outlet, useLocation } from 'react-router-dom';

export default function AppShell() {
  const loc = useLocation();
  return (
    <div style={{ fontFamily: 'Inter, system-ui', padding: 16 }}>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Link to="/app">Dashboards</Link>
        <Link to="/app/suppliers">Suppliers</Link>
        <Link to="/app/reports">Reports</Link>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
          org: {import.meta.env.VITE_ORG_ID}
        </span>
      </nav>
      <Outlet key={loc.key} />
    </div>
  );
}
