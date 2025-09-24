import React from "react";
import GoLive from "./components/GoLive";
import TimeSeriesChart from "./components/TimeSeriesChart";
import KpiStrip from "./components/KpiStrip";
import Suppliers from "./routes/Suppliers";

export default function App() {
  const [tab, setTab] = React.useState<"dashboard"|"suppliers">("dashboard");
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="js-header header-shadow sticky top-0 z-20 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3">
          <div className="flex items-center gap-3 radial rounded-lg px-2 py-1">
            <span className="text-xl">⚡</span>
            <div>
              <div className="text-sm font-semibold tracking-tight">Trust, Transparency, Transformation</div>
              <div className="text-[11px] text-slate-500">S1 MVP</div>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <button className={"badge " + (tab==="dashboard"?"bg-emerald-50 border-emerald-200":"")} onClick={()=>setTab("dashboard")}>Dashboard</button>
            <button className={"badge " + (tab==="suppliers"?"bg-emerald-50 border-emerald-200":"")} onClick={()=>setTab("suppliers")}>Suppliers</button>
            <button className="badge" onClick={()=>window.dispatchEvent(new CustomEvent("golive:open"))}>🚀 Go Live</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-3">
        {tab==="dashboard" ? (
          <>
            <section className="mb-3">
              <KpiStrip />
            </section>
            <section className="card p-3">
              <TimeSeriesChart />
            </section>
          </>
        ) : (
          <section className="card p-3">
            <Suppliers />
          </section>
        )}
      </main>

      <GoLive />
    </div>
  );
}