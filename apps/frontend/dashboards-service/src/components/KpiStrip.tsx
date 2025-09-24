import React from "react";

type KPIs = { suppliers:number; esgScore:number; devicesOnline:number; lastUpdate:string };
const LS_KEY = "kpi-cache";

export default function KpiStrip() {
  const [data, setData] = React.useState<KPIs | null>(null);
  const [stale, setStale] = React.useState(false);

  React.useEffect(() => {
    const cached = localStorage.getItem(LS_KEY);
    if (cached) { try { setData(JSON.parse(cached)); setStale(true); } catch {} }
    (async () => {
      try {
        const r = await fetch("/api/kpi/summary");
        if (!r.ok) throw new Error(String(r.status));
        const json = await r.json();
        const k: KPIs = {
          suppliers: json.suppliers ?? 0,
          esgScore: Math.round((json.esgScore ?? 0) * 10) / 10,
          devicesOnline: json.devicesOnline ?? 0,
          lastUpdate: json.lastUpdate ?? new Date().toISOString()
        };
        setData(k); setStale(false);
        localStorage.setItem(LS_KEY, JSON.stringify(k));
      } catch {
        setStale(true);
      }
    })();
  }, []);

  const ago = data ? timeAgo(data.lastUpdate) : "";

  return (
    <div className="grid grid-cols-3 gap-3">
      <Card title="Suppliers" value={fmt(data?.suppliers)} />
      <Card title="ESG Score" value={data?.esgScore?.toString() ?? "--"} />
      <Card title="Devices Online" value={fmt(data?.devicesOnline)} />
      <div className="col-span-3 text-[12px] text-slate-500">
        Updated {ago} {stale && <span className="ml-2 rounded-full bg-amber-50 px-2 py-[2px] text-amber-700">stale</span>}
      </div>
    </div>
  );
}

function Card({ title, value }: { title:string; value:string }) {
  return (
    <div className="card p-3">
      <div className="text-[12px] text-slate-500">{title}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function fmt(n: any) { return typeof n === "number" ? n.toString() : "--"; }
function timeAgo(iso: string) {
  const d = new Date(iso).getTime(); const s = Math.max(1, Math.floor((Date.now() - d)/1000));
  if (s < 60) return `${s}s ago`; const m = Math.floor(s/60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60); return `${h}h ago`;
}