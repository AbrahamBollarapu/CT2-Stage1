import { useEffect, useState } from "react";

export function useSeries({ orgId="test-org", meter="throughput", unit="count", days=7 } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const to   = new Date().toISOString();
    const from = new Date(Date.now() - days*24*60*60*1000).toISOString();
    const url  = `/api/time-series/points?org_id=${encodeURIComponent(orgId)}&meter=${encodeURIComponent(meter)}&unit=${encodeURIComponent(unit)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    fetch(url, { headers: { "x-api-key": "ct2-dev-key" }})
      .then(r => r.json())
      .then(json => {
        // Expecting { items: [{ ts, value }, ...] } or an array — normalize
        const items = Array.isArray(json) ? json : (json.items || []);
        const rows = items
          .map(p => ({ ts: p.ts, value: Number(p.value) }))
          .sort((a,b) => new Date(a.ts) - new Date(b.ts));
        setData(rows);
        setLoading(false);
      })
      .catch(e => { setErr(e); setLoading(false); });
  }, [orgId, meter, unit, days]);

  return { data, loading, err };
}
