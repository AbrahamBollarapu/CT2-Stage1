import React, { useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import KPICard from "@/components/KPICard";
import GoLiveModal from "@/components/GoLiveModal";
import Sparkline, { SparkMini } from "@/components/Sparkline";
import usePoints from "@/hooks/usePoints";

type Point = { ts: string; value: number };
const fmtPct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} %`);
const fmtKWh = (v: number | null) => (v == null ? "—" : `${v.toFixed(3)} kWh`);
const fmtV = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} V`);

export default function Dashboard() {
  const [open, setOpen] = useState(false);
  const kwh = usePoints("grid_kwh", "kwh");
  const volt = usePoints("grid_voltage", "volt");

  const { last, deltaPct, countInWindow } = useMemo(() => {
    const pts = kwh.points as Point[];
    if (!pts?.length) return { last: null as number | null, deltaPct: null as number | null, countInWindow: 0 };
    const lastVal = pts[pts.length - 1]?.value ?? null;
    const prevVal = pts.length > 1 ? pts[pts.length - 2].value : null;
    const pct = prevVal != null && prevVal !== 0 ? ((lastVal! - prevVal) / Math.abs(prevVal)) * 100 : null;
    const cut = Date.now() - 15 * 60_000;
    const cnt = pts.filter(p => new Date(p.ts).getTime() >= cut).length;
    return { last: lastVal, deltaPct: pct, countInWindow: cnt };
  }, [kwh.points]);

  return (
    <div className="min-h-screen bg-app text-app-ink">
      <Header onGoLive={() => setOpen(true)} />
      <main className="page-wrap">
        <section className="py-8">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Operations Dashboard</h1>
          <p className="kicker mt-1">Live grid kWh stream · Demo-ready S1</p>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KPICard label="kWh — last value" value={fmtKWh(last)} trend={deltaPct ?? undefined}>
            <div className="mt-2"><SparkMini points={kwh.points} colorClass="text-app-primary" /></div>
          </KPICard>
          <KPICard label="Voltage — last value" value={fmtV(volt.last)}>
            <div className="mt-2"><SparkMini points={volt.points} colorClass="text-app-accent" /></div>
          </KPICard>
          <KPICard label="Points (15m)" value={`${countInWindow}`}>
            <div className="mt-2"><SparkMini points={kwh.points} colorClass="text-app-ink/40" /></div>
          </KPICard>
        </section>

        <section className="mt-6">
          <div className="ui-card p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">Grid — kWh & Voltage (recent)</h2>
              <div className="text-sm text-app-ink-dim">{last != null ? `${last.toFixed(3)} kWh` : "—"}</div>
            </div>
            <Sparkline
              series={[
                { name: "kWh", points: kwh.points, colorClass: "text-app-primary" },
                { name: "Voltage", points: volt.points, colorClass: "text-app-accent" },
              ]}
              height={260}
              showLegend
              gradient
            />
          </div>
        </section>

        <section className="mt-6 flex gap-3">
          <button className="btn btn-primary" onClick={() => setOpen(true)}>Go Live</button>
          <button className="btn btn-ghost" onClick={async()=>{ const API=(import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, "")||""; try{ await fetch(`${API}/api/edge/ping`, {method:"POST"});}catch{}}}>
            Nudge Ingest
          </button>
        </section>
      </main>
      <Footer />
      <GoLiveModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
