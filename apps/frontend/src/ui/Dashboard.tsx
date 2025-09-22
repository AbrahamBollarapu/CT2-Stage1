import { useEffect, useMemo, useRef, useState } from "react";
import { tsRead } from "../api/timeSeries";
import { kpiCompute } from "../api/kpi";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

// ===== constants ============================================================
const ORG = (import.meta.env.VITE_ORG_ID as string) || "test-org";
const API_KEY = (import.meta.env.VITE_API_KEY as string) || "ct2-dev-key";

// ===== helpers ==============================================================
// time
function daysAgoISO(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
function nowISO() {
  return new Date().toISOString();
}

// ts normalization
type Pt = { ts: string; value: number };
function normalizeSeries(points: Pt[]) {
  const byTs = new Map<string, number>();
  for (const p of points) byTs.set(p.ts, p.value);
  return Array.from(byTs.entries())
    .map(([ts, value]) => ({ ts, value }))
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}
function fmtShort(ts: string) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

// ui atoms
function Card(props: React.PropsWithChildren<{ style?: React.CSSProperties }>) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        ...props.style,
      }}
    >
      {props.children}
    </div>
  );
}
function Skeleton({ height = 16 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        width: "100%",
        borderRadius: 8,
        background:
          "linear-gradient(90deg, #f3f3f3 25%, #ececec 37%, #f3f3f3 63%)",
        backgroundSize: "400% 100%",
        animation: "sweep 1.25s ease-in-out infinite",
      }}
    />
  );
}

// ===== KPIs ================================================================
type KPI = { total_suppliers: number; compliance_score: number };

// ===== Suppliers types =====================================================
type Supplier = {
  id: number | string;
  org_id: string;
  name: string;
  country?: string;
  created_at?: string;
};
type SuppliersResp =
  | { count: number; items: Supplier[] }
  | { error: string };

// ===== Dashboard ===========================================================
export default function Dashboard() {
  const [days, setDays] = useState<7 | 30>(7);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [series, setSeries] = useState<Pt[]>([]);
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // fetch TS + KPI
  const refresh = async (rangeDays: number) => {
    setLoading(true);
    setErr(null);
    try {
      const [tsRes, kpiRes] = await Promise.all([
        tsRead({
          org_id: ORG,
          meter: "throughput",
          unit: "count",
          from: daysAgoISO(rangeDays),
          to: nowISO(),
        }),
        kpiCompute(ORG),
      ]);
      setSeries(normalizeSeries(tsRes.points));
      setKpi(kpiRes);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  // initial + on range change
  useEffect(() => {
    refresh(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // optional auto refresh (10s)
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (autoRefresh) {
      // @ts-ignore
      timerRef.current = window.setInterval(() => refresh(days), 10_000);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, days]);

  const chartData = useMemo(
    () => series.map((p) => ({ ...p, label: fmtShort(p.ts) })),
    [series]
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>Operational Overview</h1>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <RangeToggle value={days} onChange={setDays} />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto refresh (10s)
        </label>
      </div>

      {/* KPI row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <Card>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>Total suppliers</div>
          {loading ? (
            <Skeleton height={28} />
          ) : (
            <div style={{ fontSize: 28, fontWeight: 600 }}>
              {kpi?.total_suppliers ?? "-"}
            </div>
          )}
        </Card>

        <Card>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>Compliance score</div>
          {loading ? (
            <Skeleton height={28} />
          ) : (
            <div style={{ fontSize: 28, fontWeight: 600 }}>
              {typeof kpi?.compliance_score === "number"
                ? kpi!.compliance_score.toFixed(1)
                : "-"}
            </div>
          )}
        </Card>
      </div>

      {/* Time-series line chart */}
      <Card style={{ height: 360 }}>
        <div style={{ opacity: 0.7, marginBottom: 8 }}>
          Throughput ({days}d)
        </div>
        <div style={{ height: 300 }}>
          {loading ? (
            <Skeleton height={300} />
          ) : err ? (
            <div style={{ color: "crimson" }}>Error: {err}</div>
          ) : chartData.length === 0 ? (
            <div style={{ opacity: 0.65 }}>No data in range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" minTickGap={24} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(v) => v}
                  formatter={(val) => [val as number, "count"]}
                />
                <Line type="monotone" dataKey="value" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Health chips */}
      <Card>
        <HealthBar />
      </Card>

      {/* Suppliers panel (graceful when backend is disabled) */}
      <SuppliersPanel />
    </div>
  );
}

// ===== Range Toggle =========================================================
function RangeToggle({
  value,
  onChange,
}: {
  value: 7 | 30;
  onChange: (v: 7 | 30) => void;
}) {
  const Btn = ({
    v,
    label,
  }: {
    v: 7 | 30;
    label: string;
  }) => (
    <button
      onClick={() => onChange(v)}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: "1px solid #ddd",
        background: value === v ? "#111" : "#fff",
        color: value === v ? "#fff" : "#111",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Btn v={7} label="7d" />
      <Btn v={30} label="30d" />
    </div>
  );
}

// ===== Health Bar ===========================================================
function HealthBar() {
  const [status, setStatus] = useState<{ ts?: boolean; kpi?: boolean }>();

  useEffect(() => {
    (async () => {
      try {
        const H: RequestInit = { headers: { "x-api-key": API_KEY } };
        const [tsOk, kpiOk] = await Promise.all([
          fetch("/api/time-series/health", H).then((r) => r.ok),
          fetch("/api/kpi/health", H).then((r) => r.ok),
        ]);
        setStatus({ ts: tsOk, kpi: kpiOk });
      } catch {
        setStatus({ ts: false, kpi: false });
      }
    })();
  }, []);

  const chip = (ok?: boolean) => (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        background: ok ? "#e7f8ee" : "#fdeaea",
        color: ok ? "#0a7f2e" : "#a51d2d",
        fontSize: 12,
      }}
    >
      {ok ? "healthy" : "down"}
    </span>
  );

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div>Time-series: {chip(status?.ts)}</div>
      <div>KPI: {chip(status?.kpi)}</div>
    </div>
  );
}

// ===== Suppliers Panel (optional; handles 404/disabled routers) =============
function SuppliersPanel() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; msg: string }
    | { kind: "comingsoon" } // backend disabled (404)
    | { kind: "ok"; items: Supplier[]; count: number }
  >({ kind: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(
          `/api/suppliers?org_id=${encodeURIComponent(ORG)}`,
          { headers: { "x-api-key": API_KEY } }
        );
        if (r.status === 404) {
          setState({ kind: "comingsoon" });
          return;
        }
        if (!r.ok) {
          const txt = await r.text();
          setState({
            kind: "error",
            msg: `Backend error (${r.status}): ${txt || r.statusText}`,
          });
          return;
        }
        const data = (await r.json()) as SuppliersResp;
        if ("items" in data && Array.isArray(data.items)) {
          setState({ kind: "ok", items: data.items, count: data.count ?? data.items.length });
        } else {
          setState({ kind: "ok", items: [], count: 0 });
        }
      } catch (e: any) {
        setState({ kind: "error", msg: e?.message || "Failed to load" });
      }
    })();
  }, []);

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>Suppliers</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>org: {ORG}</div>
      </div>

      {state.kind === "loading" && (
        <>
          <Skeleton height={18} />
          <div style={{ height: 8 }} />
          <Skeleton height={18} />
          <div style={{ height: 8 }} />
          <Skeleton height={18} />
        </>
      )}

      {state.kind === "comingsoon" && (
        <div style={{ opacity: 0.7 }}>
          Coming soon — backend route is disabled (showing friendly 404).
        </div>
      )}

      {state.kind === "error" && (
        <div style={{ color: "crimson" }}>{state.msg}</div>
      )}

      {state.kind === "ok" && (
        <>
          <div style={{ marginBottom: 8 }}>
            Total: <strong>{state.count}</strong>
          </div>
          {state.items.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    {["Name", "Country", "Created"].map((h) => (
                      <th key={h} style={{ padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((s) => (
                    <tr key={String(s.id)}>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid #f5f5f5" }}>
                        {s.name}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid #f5f5f5" }}>
                        {s.country || "—"}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid #f5f5f5" }}>
                        {s.created_at
                          ? new Date(s.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ opacity: 0.7 }}>No suppliers yet.</div>
          )}
        </>
      )}
    </Card>
  );
}

/* Keyframe for the Skeleton shimmering effect (scoped) */
const style = document.createElement("style");
style.innerHTML = `
@keyframes sweep { 
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}`;
document.head.appendChild(style);
