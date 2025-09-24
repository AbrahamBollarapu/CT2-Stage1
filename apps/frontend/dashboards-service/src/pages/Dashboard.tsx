// apps/frontend/dashboards-service/src/pages/Dashboard.tsx
import React from "react";
import DevicesKpiStrip from "../components/DevicesKpiStrip";
import TimeSeriesChart from "../components/TimeSeriesChart";

export default function Dashboard() {
  return (
    <div className="p-4">
      {/* Page header */}
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Dashboard
      </h1>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Live pipeline overview and energy trends
      </p>

      {/* Devices KPI strip (online status, last ingest, buffered, meter) */}
      <DevicesKpiStrip />

      {/* Main chart section */}
      <section className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-3 text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Energy Consumption
        </h2>
        <TimeSeriesChart />
      </section>
    </div>
  );
}
