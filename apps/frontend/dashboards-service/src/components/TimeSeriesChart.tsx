import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type ApiPoint = {
  ts: string;
  value: number;
  metric?: string;
  org_id?: string;
  meter?: string | null;
  unit?: string | null;
};

type UiPoint = { ts: string; value: number; localTs: string };

const RANGES = ["15m", "1h", "24h", "7d"] as const;
type RangeKey = (typeof RANGES)[number];

const REFRESH_CHOICES = [
  { label: "Off", ms: 0 },
  { label: "5s", ms: 5000 },
  { label: "10s", ms: 10000 },
  { label: "30s", ms: 30000 },
] as const;
type RefreshChoice = (typeof REFRESH_CHOICES)[number]["ms"];

export default function TimeSeriesChart() {
  const [metric, setMetric] = useState("demo.kwh");
  const [range, setRange] = useState<RangeKey>("1h");
  const [meter, setMeter] = useState<string>("");
  const [points, setPoints] = useState<UiPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh state
  const [refreshMs, setRefreshMs] = useState<RefreshChoice>(0);
  const timerRef = useRef<number | null>(null);

  async function fetchSeries() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        org_id: "test-org",
        metric,
        range,
        limit: "1000",
        order: "asc",
      });
      if (meter.trim()) params.set("meter", meter.trim());

      const res = await fetch(`/api/time-series/query?${params.toString()}`, {
        headers: { "x-api-key": "ct2-dev-key" },
      });
      if (!res.ok) throw new Error(`Query failed: ${res.status}`);

      const data = await res.json();
      const mapped: UiPoint[] = (data.points as ApiPoint[]).map((p) => {
        const d = new Date(p.ts);
        return {
          ts: p.ts,
          value: Number(p.value),
          localTs: `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`,
        };
      });
      setPoints(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // initial fetch + refetch when inputs change
  useEffect(() => {
    fetchSeries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, range, meter]);

  // set up/tear down auto-refresh timer
  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (refreshMs > 0) {
      timerRef.current = window.setInterval(() => {
        fetchSeries();
      }, refreshMs) as unknown as number;
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs, metric, range, meter]);

  const total = useMemo(
    () => points.reduce((sum, p) => sum + (Number.isFinite(p.value) ? p.value : 0), 0),
    [points]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1">Metric</label>
          <input
            className="border rounded-lg px-3 py-2 min-w-[180px]"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            placeholder="demo.kwh"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1">Meter (optional)</label>
          <input
            className="border rounded-lg px-3 py-2 min-w-[180px]"
            value={meter}
            onChange={(e) => setMeter(e.target.value)}
            placeholder="demo.meter.1"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1">Range</label>
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <button
                key={r}
                className={
                  "px-3 py-2 rounded-lg border text-sm " +
                  (range === r ? "bg-black text-white" : "bg-white hover:bg-gray-50")
                }
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1">Auto-refresh</label>
          <select
            className="border rounded-lg px-3 py-2"
            value={refreshMs}
            onChange={(e) => setRefreshMs(Number(e.target.value) as RefreshChoice)}
          >
            {REFRESH_CHOICES.map((c) => (
              <option key={c.ms} value={c.ms}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchSeries}
          className="ml-auto px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
          disabled={loading}
          title="Refresh"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Chart */}
      <div className="w-full h-[320px]">
        {error ? (
          <div className="text-red-600">Error: {error}</div>
        ) : points.length === 0 ? (
          <div className="text-sm opacity-70">No data in the selected window.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="ts"
                tickFormatter={(t) => new Date(t).toLocaleTimeString()}
                minTickGap={24}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(t) => new Date(t).toLocaleString()}
                formatter={(v: any) => [v, "kWh"]}
              />
              <Line type="monotone" dataKey="value" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary */}
      <div className="text-sm opacity-80">
        <span className="font-medium">Points:</span> {points.length} &nbsp;|&nbsp;{" "}
        <span className="font-medium">Sum (kWh):</span> {total.toFixed(2)} &nbsp;|&nbsp;{" "}
        <span className="font-medium">Metric:</span> {metric} &nbsp;|&nbsp;{" "}
        <span className="font-medium">Range:</span> {range} &nbsp;|&nbsp;{" "}
        <span className="font-medium">Auto-refresh:</span>{" "}
        {refreshMs === 0 ? "Off" : `${refreshMs / 1000}s`}
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border">
        <table className="min-w-[560px] w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 py-2">Timestamp (local)</th>
              <th className="text-left px-4 py-2">Value (kWh)</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={`${p.ts}-${i}`} className="odd:bg-white even:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap">{p.localTs}</td>
                <td className="px-4 py-2">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
