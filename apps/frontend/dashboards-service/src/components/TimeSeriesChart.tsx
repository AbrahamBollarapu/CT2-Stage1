import React from "react";

type Point = { ts: string; value: number };

const BACKOFFS = [500, 1000, 2000, 4000];

export default function TimeSeriesChart() {
  const [points, setPoints] = React.useState<Point[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [stale, setStale] = React.useState(false);
  const meter = "meter-001";
  const metric = "grid_kwh";
  const unit = "kwh";

  const fetchOnce = React.useCallback(async () => {
    setError(null);
    try {
      const now = Date.now();
      const from = new Date(now - 60 * 60 * 1000).toISOString(); // 1h
      const to = new Date(now + 3 * 60 * 1000).toISOString();
      const url = `/api/time-series/points?` + new URLSearchParams({ org_id:"test-org", metric, meter, unit, from, to }).toString();
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status}`);
      const body = await r.json().catch(() => ({}));
      const arr: Point[] = Array.isArray(body) ? body : (Array.isArray(body.points) ? body.points : []);
      setPoints(arr);
      setStale(false);
    } catch (e) {
      setError("soft");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < BACKOFFS.length; i++) {
        await fetchOnce();
        if (!cancelled && (points.length > 0 || error === null)) break;
        await new Promise(r => setTimeout(r, BACKOFFS[i]));
      }
      if (!cancelled && points.length === 0) setStale(true);
    })();
    const onTick = () => fetchOnce();
    window.addEventListener("ingest:tick", onTick);
    return () => { cancelled = true; window.removeEventListener("ingest:tick", onTick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">Live Chart — {metric} <span className="text-slate-500">({meter})</span></div>
        {stale && <div className="text-[12px] text-amber-600">Data may be stale</div>}
      </div>

      {loading ? (
        <div className="h-48 rounded-md skeleton" />
      ) : points.length === 0 ? (
        <EmptyState />
      ) : (
        <SvgMiniChart points={points} />
      )}

      {error && points.length > 0 && (
        <div className="mt-2 text-xs text-amber-700">
          Having trouble refreshing — showing last data.
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-slate-500">
      No points in window. Click <b className="mx-1">🚀 Go Live</b> or POST to <code className="mx-1">/api/edge/ingest</code>.
    </div>
  );
}

function SvgMiniChart({ points }: { points: { ts: string; value: number }[] }) {
  const w = 800, h = 220, pad = 16;
  const xs = points.map(p => new Date(p.ts).getTime());
  const ys = points.map(p => p.value);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const fx = (x:number)=> pad + ((x - minX) / Math.max(1, (maxX - minX))) * (w - pad*2);
  const fy = (y:number)=> h - pad - ((y - minY) / Math.max(1,(maxY - minY))) * (h - pad*2);
  const d = points.map((p,i)=> (i===0?"M":"L") + fx(new Date(p.ts).getTime()) + " " + fy(p.value)).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="time-series">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}