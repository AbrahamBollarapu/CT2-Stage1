import React, { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import KPICard from "@/components/KPICard";
import GoLiveModal from "@/components/GoLiveModal";
import MultiSeriesSparkline, { Series } from "@/components/MultiSeriesSparkline";
import SparkMini from "@/components/SparkMini";

type Point = { ts: string; value: number };
const API = (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, "") || "";

export default function Dashboard() {
  const [open, setOpen] = useState(false);

  const [kwh, setKwh] = useState<Point[]>([]);
  const [volt, setVolt] = useState<Point[]>([]);

  // Poll both series (every 5s)
  useEffect(() => {
    let t: number | undefined;
    const tick = async () => {
      const from = new Date(Date.now() - 15 * 60_000).toISOString();
      const to = new Date(Date.now() + 2 * 60_000).toISOString();
      const q = (metric: string, unit: string) =>
        `${API}/api/time-series/points?org_id=test-org&metric=${metric}&unit=${unit}&meter=meter-001&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

      try {
        const [r1, r2] = await Promise.all([fetch(q("grid_kwh", "kwh")), fetch(q("grid_voltage", "v"))]);
        if (r1.ok) {
          const d1 = await r1.json();
          setKwh((d1?.points ?? []).sort((a: Point, b: Point) => a.ts.localeCompare(b.ts)));
        }
        if (r2.ok) {
          const d2 = await r2.json();
          setVolt((d2?.points ?? []).sort((a: Point, b: Point) => a.ts.localeCompare(b.ts)));
        } else {
          // If voltage endpoint isn't available yet, keep calm and show only kWh
          setVolt((prev) => prev.length ? prev : []);
        }
      } catch {
        /* non-blocking */
      }

      t = window.setTimeout(tick, 5000);
    };
    tick();
    return () => { if (t) window.clearTimeout(t); };
  }, []);

  // KPIs
  const { lastKwh, deltaKwh, countKwh } = useMemo(() => {
    if (!kwh.length) return { lastKwh: null as number | null, deltaKwh: null as number | null, countKwh: 0 };
    const lastVal = kwh[kwh.length - 1].value;
    const prevVal = kwh.length > 1 ? kwh[kwh.length - 2].value : null;
    const pct = prevVal != null && prevVal !== 0 ? ((lastVal - prevVal) / Math.abs(prevVal)) * 100 : null;
    const cut = Date.now() - 15 * 60_000;
    const cnt = kwh.filter(p => new Date(p.ts).getTime() >= cut).length;
    return { lastKwh: lastVal, deltaKwh: pct, countKwh: cnt };
  }, [kwh]);

  const { lastVolt, deltaVolt } = useMemo(() => {
    if (!volt.length) return { lastVolt: null as number | null, deltaVolt: null as number | null };
    const lastVal = volt[volt.length - 1].value;
    const prevVal = volt.length > 1 ? volt[volt.length - 2].value : null;
    const pct = prevVal != null && prevVal !== 0 ? ((lastVal - prevVal) / Math.abs(prevVal)) * 100 : null;
    return { lastVolt: lastVal, deltaVolt: pct };
  }, [volt]);

  // One-shot demo ingest for "Nudge Ingest" (backdate 10s)
  const nudgeIngest = async () => {
    const ts = new Date(Date.now() - 10_000).toISOString();
    const value = +(3 + Math.random() * 0.5).toFixed(3);
    try {
      const res = await fetch(`${API}/api/edge/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          org_id: "test-org",
          metric: "grid_kwh",
          unit: "kwh",
          meter: "meter-001",
          points: [{ ts, value }],
        }),
      });
      console.log("nudge ingest:", res.status, await res.text().catch(() => ""));
    } catch {}
  };

  // Build multi-series for the big chart
  const chartSeries: Series[] = [
    { id: "kwh", label: "kWh", colorClass: "text-app-primary", points: kwh },
    { id: "volt", label: "Voltage", colorClass: "text-app-accent", points: volt }, // accent = #7ee787 (already in your theme)
  ];

  return (
    <div className="min-h-screen bg-app text-app-ink">
      <Header onGoLive={() => setOpen(true)} />

      <main className="max-w-7xl mx-auto px-4">
        <section className="py-8">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Operations Dashboard</h1>
          <p className="text-app-ink-dim mt-1">Live grid kWh stream · Demo-ready S1</p>
        </section>

        {/* KPI Row with inline micro-sparklines */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard
            label="kWh — Last value"
            value={lastKwh != null ? `${lastKwh.toFixed(3)} kWh` : "—"}
            trend={deltaKwh ?? undefined}
          >
            <div className="mt-2">
              <SparkMini data={kwh} className="text-app-primary" />
            </div>
          </KPICard>

          <KPICard
            label="Voltage — Last value"
            value={lastVolt != null ? `${lastVolt.toFixed(1)} V` : "—"}
            trend={deltaVolt ?? undefined}
          >
            <div className="mt-2">
              <SparkMini data={volt} className="text-app-accent" />
            </div>
          </KPICard>

          <KPICard label="Points (15m)" value={String(countKwh)}>
            <div className="mt-2">
              <SparkMini data={kwh} className="text-app-ink/40" />
            </div>
          </KPICard>
        </section>

        {/* Multi-series big chart */}
        <section className="mt-6">
          <div className="ui-card p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Grid — kWh & Voltage (recent)</h2>
              <div className="text-sm text-app-ink-dim">
                {lastKwh != null ? `${lastKwh.toFixed(3)} kWh` : "—"}
              </div>
            </div>
            <MultiSeriesSparkline series={chartSeries} height={220} />
          </div>
        </section>

        <section className="mt-6 flex gap-3">
          <button className="btn btn-primary" onClick={() => setOpen(true)}>Go Live</button>
          <button className="btn btn-ghost" onClick={nudgeIngest}>Nudge Ingest</button>
        </section>
      </main>

      <Footer />
      <GoLiveModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
