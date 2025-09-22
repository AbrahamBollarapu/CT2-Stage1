import React, { useEffect, useState } from "react";

interface Supplier {
  id: number;
  org_id: string;
  name: string;
  country: string;
  created_at: string;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/suppliers?org_id=test-org`,
          { headers: { "x-api-key": import.meta.env.VITE_API_KEY } }
        );
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setSuppliers(data);
      } catch (err: any) {
        setError(err.message);
      }
    };
    fetchSuppliers();
  }, []);

  if (error) return <div style={{ color: "red" }}>Error: {error}</div>;

  return (
    <div>
      <h2>Suppliers</h2>
      <ul>
        {suppliers.map(s => (
          <li key={s.id}>
            {s.name} ({s.country}) – created {new Date(s.created_at).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
