import React from "react";
import { useEdgeHealth, timeAgo } from "../hooks/useEdgeHealth";

function Pill({ tone = "ok", children }: { tone?: "ok" | "warn" | "bad" | "info"; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warn: "bg-amber-50 text-amber-700 ring-amber-200",
    bad: "bg-rose-50 text-rose-700 ring-rose-200",
    info: "bg-blue-50 text-blue-700 ring-blue-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Card({ title, value, suffix, pill }: { title: string; value: React.ReactNode; suffix?: string; pill?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">{title}</div>
        {pill}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {value}
        {suffix ? <span className="ml-1 align-middle text-sm font-medium text-zinc-500">{suffix}</span> : null}
      </div>
    </div>
  );
}

export default function DevicesKpiStrip() {
  const { data, error, isOnline, isMqtt, refresh } = useEdgeHealth({ intervalMs: 5000 });
  const last = data?.lastPostAt ?? null;

  const devicesOnline = isOnline ? 1 : 0; // single gateway for MVP
  const ingestStatusPill = isOnline ? (
    <Pill tone={isMqtt ? "ok" : "info"}>{isMqtt ? "MQTT connected" : "HTTP ingest"}</Pill>
  ) : (
    <Pill tone="bad">offline</Pill>
  );

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card title="Devices Online" value={devicesOnline} pill={ingestStatusPill} />
      <Card title="Last Ingest" value={timeAgo(last)} suffix="" pill={<Pill tone="info">{data?.device ?? "—"}</Pill>} />
      <Card title="Buffered Points" value={data?.buffered ?? 0} />
      <Card
        title="Throughput Meter"
        value={data?.config?.meter ?? "—"}
        suffix={data?.config?.unit ?? ""}
        pill={
          <button
            onClick={refresh}
            className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50 active:scale-[.99] dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
            title="Refresh now"
          >
            Refresh
          </button>
        }
      />

      {/* subtle error row */}
      {error ? (
        <div className="col-span-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          Edge health error: {error}
        </div>
      ) : null}
    </div>
  );
}
