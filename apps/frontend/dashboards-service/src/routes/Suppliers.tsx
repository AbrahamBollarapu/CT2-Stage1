import React from "react";

type Supplier = { id:string; name:string; status:string };

export default function Suppliers() {
  const [rows, setRows] = React.useState<Supplier[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/suppliers?limit=20");
        const json = await r.json().catch(()=>({ items:[] }));
        setRows(Array.isArray(json.items) ? json.items : []);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="h-24 skeleton rounded-md" />;

  return (
    <div>
      <div className="mb-2 text-sm font-semibold">Suppliers</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="px-2 py-1">ID</th>
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-2 py-1 font-mono text-[12px]">{r.id}</td>
                <td className="px-2 py-1">{r.name}</td>
                <td className="px-2 py-1">{r.status}</td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="px-2 py-6 text-slate-500" colSpan={3}>No suppliers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}