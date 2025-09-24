import { useEffect, useMemo, useRef, useState } from "react";

export type EdgeHealth = {
  ok: boolean;
  svc: string;
  device: string;
  mqtt: boolean;
  buffered: number;
  lastPostAt: string | null;
  config?: { org: string; meter: string; unit: string; sim: boolean; post_ms: number };
};

type Options = { intervalMs?: number };

export function useEdgeHealth(opts: Options = {}) {
  const { intervalMs = 5000 } = opts;
  const [data, setData] = useState<EdgeHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const apiKey = useMemo(() => (import.meta.env.VITE_API_KEY as string) ?? "ct2-dev-key", []);

  async function fetchOnce(signal?: AbortSignal) {
    try {
      setError(null);
      const res = await fetch("/api/edge/health", {
        headers: { "x-api-key": apiKey },
        signal,
      });
      if (!res.ok) throw new Error(`edge health ${res.status}`);
      const j = (await res.json()) as EdgeHealth;
      setData(j);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    const c = new AbortController();
    // initial
    fetchOnce(c.signal);
    // poll
    timer.current = window.setInterval(() => fetchOnce(c.signal), intervalMs) as any;
    return () => {
      c.abort();
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [intervalMs]);

  return { data, error, refresh: () => fetchOnce(), isOnline: !!data?.ok, isMqtt: !!data?.mqtt };
}

// Utils
export function timeAgo(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
