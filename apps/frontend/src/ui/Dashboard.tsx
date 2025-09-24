import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useToast } from "./toast";
import Skeleton from "./Skeleton";

type Range = "7d" | "30d";

const API_BASE = "/api/time-series";
const ORG_ID = import.meta.env.VITE_ORG_ID || "test-org";
const API_KEY = import.meta.env.VITE_API_KEY || "ct2-dev-key";

function dateToISO(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

function rangeToFrom(range: Range) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (range === "7d" ? 7 : 30));
  return { from: dateToISO(from), to: dateToISO(to) };
}

function useThroughputSeries(range: Range, autoRefreshMs = 30000) {
  const [data, setData] = React.useState<{ ts: string; value: number }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = rangeToFrom(range);
      const u = new URL(`${API_BASE}/points`, window.location.origin);
      u.searchParams.set("org_id", String(ORG_ID));
      u.searchParams.set("meter", "throughput");
      u.searchParams.set("unit", "count");
      u.searchParams.set("from", from);
      u.searchParams.set("to", to);

      const res = await fetch(u.toString().replace(window.location.origin, ""), {
        headers: { "x-api-key": String(API_KEY) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const series = (json.points || []).map((p: any) => ({
        ts: p.ts,
        value: Number(p.value),
      }));
      setData(series);
    } catch (e: any) {
      setError(e.message || "failed to load");
    } finally {
      setLoading(false);
    }
  }, [range]);

  React.useEffect(() => {
    let timer: any;
    load();
    if (autoRefreshMs > 0) {
      timer = setInterval(load, autoRefreshMs);
    }
    return () => timer && clearInterval(timer);
  }, [load, autoRefreshMs]);

  return { data, loading, error, reload: load };
}

function formatTick(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const [range, setRange] = React.useState<Range>("7d");
  const { data, loading, error, reload } = useThroughputSeries(range, 30000);
  const { toast } = useToast();

  // show a toast exactly when error changes
  React.useEffect(() => {
    if (error) {
      toast({
        variant: "error",
        title: "Time-series load failed",
        description: error,
      });
    }
  }, [error, toast]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRange("7d")}
            className={`px-3 py-1.5 rounded-full border text-sm ${range === "7d" ? "bg-black text-white" : "hover:bg-gray-100"}`}
          >
            7d
          </button>
          <button
            onClick={() => setRange("30d")}
            className={`px-3 py-1.5 rounded-full border text-sm ${range === "30d" ? "bg-black text-white" : "hover:bg-gray-100"}`}
          >
            30d
          </button>
          <button
            onClick={() => reload()}
            className="px-3 py-1.5 rounded-full border text-sm hover:bg-gray-100"
            title="Refresh now"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border p-4 shadow-sm">
          <div className="text-sm text-gray-500">Throughput (last {range})</div>
          <div className="mt-1 text-2xl font-semibold">
            {loading && !data.length ? <Skeleton className="h-7 w-16" /> : (data.length ? data[data.length - 1].value : "--")}
          </div>
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border">
              health: <span className="ml-1 h-2 w-2 rounded-full bg-green-500 inline-block" />
            </span>
          </div>
        </div>
      </div>

      {/* Chart card */}
      <div className="rounded-xl border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-gray-500">Time-series</div>
            <div className="text-lg font-medium">Throughput</div>
          </div>
          <div className="text-sm">
            Auto-refresh: <span className="font-medium">30s</span>
          </div>
        </div>

        <div className="h-72">
          {loading && !data.length ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.map(d => ({ ...d, x: new Date(d.ts) }))}
                margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ts" tickFormatter={formatTick} minTickGap={24} />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(label) => new Date(label as string).toLocaleString()} />
                <Line type="monotone" dataKey="value" dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
