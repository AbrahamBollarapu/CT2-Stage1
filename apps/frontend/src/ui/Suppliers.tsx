import { useEffect, useState } from 'react';
import { listSuppliers, type Supplier } from '../api/suppliers';

const ORG = import.meta.env.VITE_ORG_ID as string;

export default function Suppliers() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await listSuppliers(ORG);
        setItems(res.items || []);
      } catch (e: any) {
        setErr(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div>Loading…</div>;
  if (err) return <div style={{ color: 'crimson' }}>Error: {err}</div>;

  return (
    <div style={{ fontFamily: 'Inter, system-ui' }}>
      <h2>Suppliers</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Name</th>
            <th align="left">Country</th>
            <th align="left">Created</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.country || '-'}</td>
              <td>{s.created_at || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
