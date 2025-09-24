import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../lib/api";

type Check = {
  id: string;
  label: string;
  url: string;
  method?: "GET" | "POST";
  body?: any;
};

type Result = {
  id: string;
  ok: boolean;
  status: number | "ERR";
  ms: number;
  error?: string;
  at: string;
};

const DEFAULT_CHECKS: Check[] = [
  { id: "dash", label: "Dashboards UI", url: `${API_BASE || ""}/health` },
  { id: "edge", label: "Edge Gateway", url: `${API_BASE}/api/edge/health` },
  { id: "ts", label: "Time-Series", url: `${API_BASE}/api/time-series/health` },
  { id: "kpi", label: "KPI", url: `${API_BASE}/api/kpi/health` },
  // feel free to add more:
  // { id: "suppliers", label: "Suppliers", url: `${API_BASE}/api/suppliers/health` },
];

async function ping(c: Check, signal?: AbortSignal): Promise<Result> {
  const t0 = performance.now();
  try {
    const res = await fetch(c.url, {
      method: c.method || "GET",
      headers: c.body ? { "Content-Type": "application/json" } : undefined,
      body: c.body ? JSON.stringify(c.body) : undefined,
      signal,
    });
    const ms = Math.round(performance.now() - t0);
    return { id: c.id, ok: res.ok, status: res.status, ms, at: new Date().toLocaleTimeString() };
  } catch (e: any) {
    const ms = Math.round(performance.now() - t0);
    return { id: c.id, ok: false, status: "ERR", ms, error: String(e?.message || e), at: new Date().toLocaleTimeString() };
  }
}

export default function Healthz() {
  const [checks, _] = useState<Check[]>(DEFAULT_CHECKS);
  const [rows, setRows] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const okCount = useMemo(() => rows.filter(r => r.ok).length, [rows]);

  async function run() {
    setLoading(true);
    const ctl = new AbortController();
    try {
      const out = await Promise.all(checks.map(c => ping(c, ctl.signal)));
      setRows(out);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void run(); }, []); // auto-run on mount

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,.06)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight">Healthz</h3>
        <div className="flex items-center gap-2">
          <div className="text-xs text-black/60">{okCount}/{checks.length} OK</div>
          <button
            onClick={run}
            disabled={loading}
            className="rounded-md border px-2 py-1 text-sm disabled:opacity-60"
          >
            {loading ? "Checking…" : "Recheck"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[560px] w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-black/60">
              <th className="px-2 py-1">Service</th>
              <th className="px-2 py-1">Endpoint</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1">Latency</th>
              <th className="px-2 py-1">Checked</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => {
              const r = rows.find(x => x.id === c.id);
              return (
                <tr key={c.id} className="border-t">
                  <td className="px-2 py-1">{c.label}</td>
                  <td className="px-2 py-1 text-xs text-black/70">
                    <code>{c.url.replace(location.origin, "")}</code>
                  </td>
                  <td className="px-2 py-1">
                    {r ? (
                      r.ok ? (
                        <span className="rounded-md border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-900">OK {r.status}</span>
                      ) : (
                        <span className="rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900">
                          {r.status === "ERR" ? "ERR" : r.status}
                        </span>
                      )
                    ) : "—"}
                  </td>
                  <td className="px-2 py-1 tabular-nums">{r ? `${r.ms} ms` : "—"}</td>
                  <td className="px-2 py-1 text-xs text-black/60">{r?.at || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-black/60">
        Tip: add/remove services in <code>Healthz.tsx</code> → <code>DEFAULT_CHECKS</code>.
      </p>
    </div>
  );
}
