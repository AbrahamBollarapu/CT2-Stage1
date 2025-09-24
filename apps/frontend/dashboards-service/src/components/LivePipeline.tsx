import { useEffect, useMemo, useState } from "react";

type Check = {
  id: string;
  label: string;
  path: string;               // relative path to GET (via Traefik)
  method?: "GET" | "POST";
  ok: boolean | null;         // null = loading, true/false = status
  latencyMs?: number;
  details?: string;
  doc?: string;               // optional docs url (opens in new tab)
};

const API = (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, "") || "";

const baseChecks: Check[] = [
  { id: "hardware", label: "Hardware",            path: "/api/edge/health",       ok: null, details: "device → gateway",       doc: "" },
  { id: "edge",     label: "Edge Gateway",        path: "/api/edge/health",       ok: null, details: "ingest pipeline",        doc: "" },
  { id: "api",      label: "API",                 path: "/health",                ok: null, details: "dashboards service",     doc: "" },
  { id: "ts",       label: "Time-Series",         path: "/api/time-series/health",ok: null, details: "write/read datapoints",  doc: "" },
  { id: "kpi",      label: "KPIs",                path: "/api/kpi/health",        ok: null, details: "aggregations",           doc: "" },
];

function Pill({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-gray-200">checking…</span>;
  if (ok) return <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-emerald-600 text-white">passes data</span>;
  return <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-rose-600 text-white">issue</span>;
}

function Card({ c, onOpen }: { c: Check; onOpen: (c: Check) => void }) {
  return (
    <button
      onClick={() => onOpen(c)}
      className={`w-full text-left rounded-2xl border px-4 py-3 shadow-sm transition
      ${c.ok === null ? "bg-white"
        : c.ok ? "bg-emerald-50 border-emerald-200"
        : "bg-rose-50 border-rose-200 hover:border-rose-300"}
      hover:shadow-md`}
      title={`Open ${c.label} health`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">{c.label}</div>
          <div className="text-xs opacity-70">{c.details}</div>
        </div>
        <div className="text-right">
          <Pill ok={c.ok} />
          <div className="text-[11px] opacity-60 mt-1">{c.latencyMs ? `${c.latencyMs} ms` : ""}</div>
        </div>
      </div>
    </button>
  );
}

export default function LivePipeline({
  auto = true,
  intervalMs = 15000,
}: {
  auto?: boolean;
  intervalMs?: number;
}) {
  const [checks, setChecks] = useState<Check[]>(baseChecks);

  async function runOne(c: Check): Promise<Check> {
    const url = `${API}${c.path}`;
    const t0 = performance.now();
    try {
      const r = await fetch(url, { method: c.method ?? "GET" });
      const t1 = performance.now();
      const ok = r.ok;
      return { ...c, ok, latencyMs: Math.round(t1 - t0) };
    } catch (e) {
      const t1 = performance.now();
      return { ...c, ok: false, latencyMs: Math.round(t1 - t0) };
    }
  }

  async function runAll() {
    setChecks((xs) => xs.map((x) => ({ ...x, ok: null })));
    const results = await Promise.all(baseChecks.map(runOne));
    setChecks(results);
  }

  useEffect(() => {
    runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(runAll, intervalMs);
    return () => window.clearInterval(id);
  }, [auto, intervalMs]);

  const onOpen = (c: Check) => {
    // Open health endpoint in a new tab
    const url = `${API}${c.path}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const allOk = useMemo(() => checks.every((c) => c.ok === true), [checks]);

  return (
    <section id="pipeline" className="rounded-2xl p-4 shadow-md bg-white/70 dark:bg-zinc-900/60">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold">Live pipeline</div>
          <div className="text-xs opacity-70">Hardware → Gateway → API → Time-Series → KPIs → Dashboard</div>
        </div>
        <div className={`text-xs px-2 py-1 rounded-full ${allOk ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}>
          {allOk ? "All systems nominal" : "Degraded / checking"}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {checks.map((c) => <Card key={c.id} c={c} onOpen={onOpen} />)}
      </div>
    </section>
  );
}
