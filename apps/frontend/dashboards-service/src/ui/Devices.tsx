// apps/frontend/dashboards-service/src/ui/Devices.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../ui/toast";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");
const H: HeadersInit = { "x-api-key": "ct2-dev-key", "content-type": "application/json" };
const ORG_ID = "test-org";

// Optional: set this in .env to probe a direct health endpoint if you expose one through Traefik.
// Example: VITE_EDGE_HEALTH_URL=/api/edge/health   (proxy it in your dashboards-service if you like)
const EDGE_HEALTH_URL = (import.meta.env.VITE_EDGE_HEALTH_URL ?? "").trim() || null;
// Optional display label for the demo device
const DEVICE_ID = (import.meta.env.VITE_DEVICE_ID ?? "demo-edge-001").trim();

type TsPoint = { ts: string; value: number };
type EdgeHealth =
  | { ok: true; device?: string; mqtt?: boolean; buffered?: number; lastPostAt?: string }
  | null;

async function getTsWindow(params: {
  org_id: string; meter: string; unit: string; from: string; to: string;
}): Promise<{ points: TsPoint[] }> {
  const q = new URLSearchParams(params as any).toString();
  const r = await fetch(`${API_BASE}/api/time-series/points?${q}`, { headers: H });
  if (!r.ok) throw new Error(`ts_${r.status}`);
  return r.json();
}

async function getEdgeHealth(url: string): Promise<EdgeHealth> {
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(`edge_${r.status}`);
  return r.json();
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`}
      aria-hidden
    />
  );
}

export default function Devices() {
  const { push } = useToast();

  // Inferred ingest status from recent points (last 2 minutes)
  const [points, setPoints] = useState<TsPoint[]>([]);
  const [tsLoading, setTsLoading] = useState(true);
  const [tsErr, setTsErr] = useState<string | null>(null);

  // Optional direct edge health (if routed)
  const [edge, setEdge] = useState<EdgeHealth>(null);
  const [edgeLoading, setEdgeLoading] = useState(!!EDGE_HEALTH_URL);
  const [edgeErr, setEdgeErr] = useState<string | null>(null);

  // Load recent points (2m) — this drives last ingest time + inferred status
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
        if (!dead) { setPoints(r.points ?? []); setTsErr(null); }
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (!dead) { setTsErr(msg); push({ tone: "danger", title: "Failed to fetch recent points", description: msg }); }
      } finally {
        if (!dead) setTsLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [push]);

  // Optionally probe edge health URL if provided
  useEffect(() => {
    if (!EDGE_HEALTH_URL) return;
    let dead = false;
    setEdgeLoading(true);
    (async () => {
      try {
        const h = await getEdgeHealth(EDGE_HEALTH_URL);
        if (!dead) { setEdge(h ?? null); setEdgeErr(null); }
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (!dead) { setEdgeErr(msg); push({ tone: "warning", title: "Edge health unavailable", description: msg }); }
      } finally {
        if (!dead) setEdgeLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [push]);

  // Derived: last ingest timestamp (from most recent point)
  const lastPointIso = useMemo(() => {
    if (!points.length) return null;
    const latest = points.reduce((a, b) => (a.ts > b.ts ? a : b));
    return latest.ts;
  }, [points]);

  const lastIngestAgeSec = useMemo(() => {
    if (!lastPointIso) return null;
    const t = new Date(lastPointIso).getTime();
    return Math.max(0, Math.round((Date.now() - t) / 1000));
  }, [lastPointIso]);

  const inferredOnline = useMemo(() => (points.length > 0), [points]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Devices</h2>
          <p className="text-xs text-neutral-500">
            Edge gateway status and last ingest (inferred from recent throughput points)
          </p>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid md:grid-cols-3 gap-3">
        {/* Device/Gateway card */}
        <div className="rounded-2xl shadow-sm border border-black/5 bg-white dark:bg-neutral-900 p-4">
          <div className="text-xs text-neutral-500 mb-1">Gateway</div>
          <div className="flex items-center gap-2">
            <StatusDot ok={inferredOnline} />
            <div className="text-2xl font-semibold">{DEVICE_ID}</div>
          </div>
          <div className="mt-2 text-xs text-neutral-500">Status inferred via ingest activity</div>
        </div>

        {/* Last ingest card */}
        <div className="rounded-2xl shadow-sm border border-black/5 bg-white dark:bg-neutral-900 p-4">
          <div className="text-xs text-neutral-500 mb-1">Last Ingest</div>
          {tsLoading ? (
            <Skeleton height={28} width={160} />
          ) : lastPointIso ? (
            <div className="text-2xl font-semibold">
              {new Date(lastPointIso).toLocaleTimeString()}{" "}
              <span className="text-sm text-neutral-500">
                ({lastIngestAgeSec}s ago)
              </span>
            </div>
          ) : (
            <div className="text-sm text-rose-500">No points in last 2 minutes</div>
          )}
          {tsErr && !tsLoading && <div className="text-xs text-rose-500 mt-1">{tsErr}</div>}
        </div>

        {/* Optional direct health */}
        <div className="rounded-2xl shadow-sm border border-black/5 bg-white dark:bg-neutral-900 p-4">
          <div className="text-xs text-neutral-500 mb-1">Edge Health (direct)</div>
          {!EDGE_HEALTH_URL ? (
            <div className="text-sm text-neutral-500">
              No <code>VITE_EDGE_HEALTH_URL</code> configured. Using inferred status.
            </div>
          ) : edgeLoading ? (
            <Skeleton height={28} width={200} />
          ) : edgeErr ? (
            <div className="text-sm text-rose-500">{edgeErr}</div>
          ) : edge?.ok ? (
            <div className="text-sm">
              <div className="flex items-center gap-2">
                <StatusDot ok />
                <div>MQTT: {edge.mqtt ? "connected" : "disconnected"}</div>
              </div>
              <div className="text-neutral-500 mt-1">
                Buffered: {edge.buffered ?? 0}
                {edge.lastPostAt ? ` • lastPostAt: ${new Date(edge.lastPostAt).toLocaleTimeString()}` : ""}
              </div>
            </div>
          ) : (
            <div className="text-sm text-neutral-500">Unavailable</div>
          )}
        </div>
      </div>

      {/* Recent activity table */}
      <div className="rounded-2xl shadow-sm border border-black/5 bg-white dark:bg-neutral-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Recent Throughput (last 2m)</div>
          <div className="text-xs text-neutral-500">Edge → API → Time-Series</div>
        </div>
        {tsLoading ? (
          <div className="space-y-2">
            <Skeleton height={24} />
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={18} />)}
          </div>
        ) : points.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-neutral-500">
            No data in the last 2 minutes.
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-black/5">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-100 dark:bg-neutral-900/60">
                <tr>
                  <th className="text-left font-semibold px-3 py-2 w-[220px]">Timestamp</th>
                  <th className="text-left font-semibold px-3 py-2 w-[120px]">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {points
                  .slice()
                  .sort((a, b) => (a.ts < b.ts ? 1 : -1))
                  .map((p, i) => (
                    <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
                      <td className="px-3 py-2">{new Date(p.ts).toLocaleString()}</td>
                      <td className="px-3 py-2 tabular-nums">{p.value}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-neutral-500">
        Tip: To enable the direct health card, expose your edge gateway’s <code>/health</code> via Traefik and set <code>VITE_EDGE_HEALTH_URL</code>.
      </div>
    </div>
  );
}
