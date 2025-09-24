// apps/frontend/dashboards-service/src/ui/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../ui/toast";

// --- Config / tiny helpers ---
const ORG_ID = "test-org";
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");
const H: HeadersInit = { "x-api-key": "ct2-dev-key" };

type KpiResp = { org_id: string; kpis: { name: string; value: number }[]; updated_at: string };
type Point = { ts: string; value: number };

async function getKpi(orgId: string): Promise<KpiResp> {
  const r = await fetch(`${API_BASE}/api/kpi?org_id=${encodeURIComponent(orgId)}`, { headers: H });
  if (!r.ok) throw new Error(`kpi_${r.status}`);
  return r.json();
}

async function getTsWindow(params: {
  org_id: string; meter: string; unit: string; from: string; to: string;
}): Promise<{ points: Point[] }> {
  const q = new URLSearchParams(params as any).toString();
  const r = await fetch(`${API_BASE}/api/time-series/points?${q}`, { headers: H });
  if (!r.ok) throw new Error(`ts_${r.status}`);
  return r.json();
}

function useAutoRefresh(ms: number) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  useEffect(() => {
    setLastUpdated(new Date());
    const t = window.setInterval(() => setLastUpdated(new Date()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return { lastUpdated };
}

// --- Local UI bits ---
function HeaderStrip({ windowLabel, lastUpdated }: { windowLabel: "7d" | "30d"; lastUpdated: Date | null }) {
  const ago = useMemo(() => {
    if (!lastUpdated) return null;
    const s = Math.max(1, Math.round((Date.now() - lastUpdated.getTime()) / 1000));
    return `${s}s ago`;
  }, [lastUpdated]);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
      <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800">
        Window: {windowLabel}
      </span>
      {ago && <span>• last updated {ago}</span>}
    </div>
  );
}

export default function Dashboard() {
  const pointsWindow: "7d" | "30d" = "7d";
  const { lastUpdated } = useAutoRefresh(12_000);
  const { push } = useToast();

  // KPI state
  const [kpi, setKpi] = useState<KpiResp | null>(null);
  const [kpiErr, setKpiErr] = useState<string | null>(null);
  const [kpiLoading, setKpiLoading] = useState<boolean>(true);

  // Devices-Online (2m) state
  const [devicesOnline, setDevicesOnline] = useState<number | null>(null);
  const [devErr, setDevErr] = useState<string | null>(null);
  const [tsLoading, setTsLoading] = useState<boolean>(true);

  // 7d Avg Throughput state
  const [avg7d, setAvg7d] = useState<number | null>(null);
  const [avgErr, setAvgErr] = useState<string | null>(null);
  const [avgLoading, setAvgLoading] = useState<boolean>(true);

  // Load KPI
  useEffect(() => {
    let dead = false;
    setKpiLoading(true);
    (async () => {
      try {
        const data = await getKpi(ORG_ID);
        if (!dead) setKpi(data);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (!dead) {
          setKpiErr(msg);
          push({ tone: "danger", title: "KPI load failed", description: msg });
        }
      } finally {
        if (!dead) setKpiLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [push]);

  // Devices Online from last 2 minutes
  useEffect(() => {
    let dead = false;
    setTsLoading(true);
    (async () => {
      try {
        const to = new Date();
        const from = new Date(to.getTime() - 2 * 60 * 1000);
        const r = await getTsWindow({
          org_id: ORG_ID, meter: "throughput", unit: "count",
          from: from.toISOString(), to: to.toISOString(),
        });
        const online = (r.points?.length ?? 0) > 0 ? 1 : 0;
        if (!dead) { setDevicesOnline(online); setDevErr(null); }
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (!dead) { setDevErr(msg); push({ tone: "danger", title: "Throughput fetch failed", description: msg }); }
      } finally {
        if (!dead) setTsLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [lastUpdated, push]); // re-check alongside the header ticker

  // 7d average throughput (mean of all values in the last 7 days)
  useEffect(() => {
    let dead = false;
    setAvgLoading(true);
    (async () => {
      try {
        const to = new Date();
        const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
        const r = await getTsWindow({
          org_id: ORG_ID, meter: "throughput", unit: "count",
          from: from.toISOString(), to: to.toISOString(),
        });
        const pts = r.points ?? [];
        const avg = pts.length ? pts.reduce((s, p) => s + (Number(p.value) || 0), 0) / pts.length : 0;
        if (!dead) { setAvg7d(Number.isFinite(avg) ? Math.round(avg * 100) / 100 : 0); setAvgErr(null); }
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (!dead) { setAvgErr(msg); push({ tone: "danger", title: "7d average failed", description: msg }); }
      } finally {
        if (!dead) setAvgLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [lastUpdated, push]); // refresh alongside ticker so it “breathes” in demos

  // KPI derived values
  const totalSuppliers = useMemo(() => {
    const v = kpi?.kpis.find(k => k.name === "total_suppliers")?.value;
    return Number.isFinite(v) ? v : 42;
  }, [kpi]);

  const compliance = useMemo(() => {
    const v = kpi?.kpis.find(k => k.name === "compliance_score")?.value;
    return Number.isFinite(v) ? v : 85.5;
  }, [kpi]);

  return (
    <div className="p-4">
      {/* Title + header strip */}
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Dashboard</h2>
          <p className="text-xs text-neutral-500">KPI • Time-Series • Suppliers</p>
        </div>
        <HeaderStrip windowLabel={pointsWindow} lastUpdated={lastUpdated} />
      </div>

      {/* KPI mini-cards */}
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        {/* Total Suppliers */}
        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:bg-neutral-900">
          <div className="mb-1 text-xs text-neutral-500">Total Suppliers</div>
          {kpiLoading ? <Skeleton height={36} width={80} /> : <div className="text-3xl font-semibold">{totalSuppliers}</div>}
          {kpiErr && !kpiLoading && <div className="mt-1 text-xs text-rose-500">{kpiErr}</div>}
        </div>

        {/* Compliance */}
        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:bg-neutral-900">
          <div className="mb-1 text-xs text-neutral-500">Compliance</div>
          {kpiLoading ? (
            <Skeleton height={36} width={100} />
          ) : (
            <div className="text-3xl font-semibold">{Number.isFinite(compliance) ? `${compliance}%` : "—"}</div>
          )}
        </div>

        {/* Devices Online */}
        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:bg-neutral-900">
          <div className="mb-1 text-xs text-neutral-500">Devices Online</div>
          {tsLoading ? <Skeleton height={36} width={60} /> : <div className="text-3xl font-semibold">{devicesOnline ?? "—"}</div>}
          {devErr ? (
            <div className="mt-1 text-xs text-rose-500">{devErr}</div>
          ) : (
            !tsLoading && <div className="mt-1 text-xs text-neutral-500">via throughput (last 2m)</div>
          )}
        </div>

        {/* 7d Avg Throughput */}
        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:bg-neutral-900">
          <div className="mb-1 text-xs text-neutral-500">7d Avg Throughput</div>
          {avgLoading ? <Skeleton height={36} width={120} /> : <div className="text-3xl font-semibold">{avg7d ?? "—"}</div>}
          {avgErr && !avgLoading && <div className="mt-1 text-xs text-rose-500">{avgErr}</div>}
        </div>
      </div>

      {/* Throughput panel */}
      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:bg-neutral-900">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Energy Consumption (Throughput)</div>
          <div className="text-xs text-neutral-500">Edge → API → Time-Series → UI</div>
        </div>

        {/* Chart skeleton while first TS window loads */}
        {tsLoading ? (
          <div className="space-y-3">
            <Skeleton height={220} />
            <div className="flex gap-2">
              <Skeleton height={12} width="20%" />
              <Skeleton height={12} width="30%" />
              <Skeleton height={12} width="15%" />
            </div>
          </div>
        ) : (
          <TimeSeriesChart />
        )}
      </div>
    </div>
  );
}
