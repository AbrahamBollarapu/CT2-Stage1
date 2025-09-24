import React, { useEffect, useRef, useState } from "react";
type Pos = "br" | "bl";
const POS_KEY = "golive-pos";

function cls(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

const ORG_ID = "test-org";
const ingestCandidates = (metric:string, meter:string) => [
  `/api/edge/ingest?${new URLSearchParams({ org_id: ORG_ID, metric, unit: "kwh", meter }).toString()}`,
  `/api/time-series/points?${new URLSearchParams({ org_id: ORG_ID, metric, unit: "kwh", meter }).toString()}`,
];
async function postJson(url:string, body:any, signal?:AbortSignal) {
  const r = await fetch(url, { method: "POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body), signal });
  let txt = ""; try { txt = await r.text(); } catch {}
  return { ok: r.ok, status: r.status, text: txt };
}

export default function GoLive() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [pos, setPos] = useState<Pos>(() => (localStorage.getItem(POS_KEY) as Pos) || "br");
  const [rate, setRate] = useState(2);
  const [jitter, setJitter] = useState(8);
  const [meter, setMeter] = useState("meter-001");
  const [metric, setMetric] = useState("grid_kwh");
  const [count, setCount] = useState(0);
  const [valueBase, setValueBase] = useState(2.4);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const tRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const on = (e: Event) => setOpen(true);
    window.addEventListener("golive:open", on);
    // DEV helpers
    (window as any).__ct2 = {
      ...(window as any).__ct2,
      openGoLive: () => setOpen(true),
      startGoLive: () => { setOpen(true); queueMicrotask(() => start()); },
      stopGoLive: () => stop(),
    };
    return () => window.removeEventListener("golive:open", on);
  }, []);

  useEffect(() => localStorage.setItem(POS_KEY, pos), [pos]);

  function stopLoop() {
    if (tRef.current) { window.clearInterval(tRef.current); tRef.current = null; }
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  }

  function buildPoints(now: number) {
    return Array.from({ length: rate }).map((_, i) => {
      const ts = new Date(now - (rate - 1 - i) * 250).toISOString();
      const rnd = 1 + (Math.random() * 2 - 1) * (jitter / 100);
      const value = +(valueBase * rnd).toFixed(3);
      return { ts, value };
    });
  }

  async function postWithFallback(points: { ts: string; value: number }[]) {
    const urls = endpoint ? [endpoint] : ingestCandidates(metric, meter);
    const bodies = [{ org_id: ORG_ID, metric, meter, unit:"kwh", points }, { points }];
    for (let i = 0; i < urls.length; i++) {
      abortRef.current = new AbortController();
      const r = await postJson(urls[i], bodies[i] ?? bodies[bodies.length - 1], abortRef.current.signal);
      if (r.ok) return urls[i];
    }
    throw new Error("All ingest endpoints failed");
  }

  async function pushOnce() {
    const now = Date.now();
    const points = buildPoints(now);
    try {
      const ok = await postWithFallback(points);
      if (!endpoint) setEndpoint(ok);
      setCount((c) => c + points.length);
      setValueBase((v) => +(v + (Math.random() - 0.5) * 0.03).toFixed(3));
      window.dispatchEvent(new Event("ingest:tick"));
    } catch {}
  }

  function start() {
    if (running) return;
    setCount(0); setRunning(true); stopLoop();
    void pushOnce();
    tRef.current = window.setInterval(() => void pushOnce(), 1000);
  }
  function stop() { stopLoop(); setRunning(false); }
  useEffect(() => stop, []);

  return (
    <>
      <button
        data-testid="golive-fab"
        className={cls(
          "fixed z-30 rounded-full border bg-white px-4 py-2 text-sm shadow-[0_6px_18px_rgba(0,0,0,.12)] hover:shadow-[0_10px_22px_rgba(0,0,0,.16)] focus:outline-none",
          pos === "br" ? "right-4 bottom-4" : "left-4 bottom-4"
        )}
        onClick={() => setOpen(true)}
        aria-label="Go Live"
        title="Go Live"
      >
        🚀 Go Live
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/20 p-4 sm:items-center" data-testid="golive-overlay">
          <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white shadow-[0_24px_60px_rgba(0,0,0,.18)]" data-testid="golive-modal">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,.6)]" />
                <h3 className="text-sm font-semibold tracking-tight">Go Live — Demo Ingest</h3>
              </div>
              <button className="rounded-md border px-2 py-1 text-sm" onClick={() => setOpen(false)}>Close</button>
            </div>

            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
              <label className="text-xs">
                Meter
                <select className="mt-1 w-full rounded-md border px-2 py-1 text-sm" value={meter} onChange={(e) => setMeter(e.target.value)}>
                  <option>meter-001</option><option>meter-002</option><option>meter-003</option>
                </select>
              </label>
              <label className="text-xs">
                Metric
                <select className="mt-1 w-full rounded-md border px-2 py-1 text-sm" value={metric} onChange={(e) => setMetric(e.target.value)}>
                  <option>grid_kwh</option><option>temp_c</option><option>co2_ppm</option>
                </select>
              </label>
              <label className="text-xs">
                Rate (points/sec): <b className="tabular-nums">{rate}</b>
                <input className="mt-1 w-full" type="range" min={1} max={6} step={1} value={rate} onChange={(e) => setRate(parseInt(e.target.value))}/>
              </label>
              <label className="text-xs">
                Jitter (%): <b className="tabular-nums">{jitter}</b>
                <input className="mt-1 w-full" type="range" min={0} max={20} step={1} value={jitter} onChange={(e) => setJitter(parseInt(e.target.value))}/>
              </label>
              <label className="text-xs">
                Corner (FAB)
                <select className="mt-1 w-full rounded-md border px-2 py-1 text-sm" value={pos} onChange={(e) => setPos(e.target.value as Pos)}>
                  <option value="br">Bottom Right</option><option value="bl">Bottom Left</option>
                </select>
              </label>
              <div className="text-xs">
                Sent points
                <div className="mt-1 rounded-md border bg-slate-50 px-2 py-1 font-mono text-sm" data-testid="golive-sent">
                  {count}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
              <div className="text-xs text-black/60">
                POST <code data-testid="golive-endpoint">{endpoint || "/api/edge/ingest ↺ /api/time-series/points"}</code> • org=<b>{ORG_ID}</b> • meter=<b>{meter}</b> • metric=<b>{metric}</b>
              </div>
              <div className="flex gap-2">
                {!running ? (
                  <button data-testid="golive-start" className="rounded-md border px-3 py-1.5 text-sm shadow hover:shadow-md active:translate-y-[0.5px] transition" onClick={start}>
                    ▶ Start
                  </button>
                ) : (
                  <button data-testid="golive-stop" className="rounded-md border px-3 py-1.5 text-sm shadow hover:shadow-md active:translate-y-[0.5px] transition" onClick={stop}>
                    ■ Stop
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}