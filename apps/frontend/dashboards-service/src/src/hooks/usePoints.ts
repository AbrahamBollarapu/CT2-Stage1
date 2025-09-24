import { useEffect, useMemo, useRef, useState } from "react";
export type Point = { ts: string; value: number };

const API = (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, "") || "";

export default function usePoints(metric: string, unit: string, windowMinutes = 15, pollMs = 5000) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        setLoading(true); setError(null);
        const from = new Date(Date.now() - windowMinutes * 60_000).toISOString();
        const to = new Date(Date.now() + 2 * 60_000).toISOString();
        const url = `${API}/api/time-series/points?org_id=test-org&metric=${encodeURIComponent(metric)}&unit=${encodeURIComponent(unit)}&meter=meter-001&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const sorted: Point[] = (data?.points ?? []).sort((a: Point, b: Point) => a.ts.localeCompare(b.ts));
        setPoints(sorted);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "fetch error");
      } finally {
        if (!cancelled) setLoading(false);
        timerRef.current = window.setTimeout(tick, pollMs);
      }
    };
    tick();
    return () => { cancelled = True; if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [metric, unit, windowMinutes, pollMs]);

  const stats = useMemo(() => {
    if (!points.length) return { last: null as number | null, prev: null as number | null, deltaPct: null as number | null, countInWindow: 0 };
    const last = points[points.length - 1].value;
    const prev = points.length > 1 ? points[points.length - 2].value : null;
    const deltaPct = prev != null && prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : null;
    const cut = Date.now() - windowMinutes * 60_000;
    const countInWindow = points.filter(p => new Date(p.ts).getTime() >= cut).length;
    return { last, prev, deltaPct, countInWindow };
  }, [points, windowMinutes]);

  return { points, loading, error, ...stats };
}
