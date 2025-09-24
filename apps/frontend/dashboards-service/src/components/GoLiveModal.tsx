import React, { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const API = (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, "") || "";

/**
 * Posts BOTH metrics every ~5s:
 *  - grid_kwh (kwh)
 *  - grid_voltage (volt)
 * Backdates ts ~10s so the reader window always includes them.
 * Shows SENT counter (ticks per POST) and "Last" with server status + values.
 */
export default function GoLiveModal({ open, onOpenChange }: Props) {
  const [running, setRunning] = useState(false);
  const [sent, setSent] = useState(0);
  const [lastMsg, setLastMsg] = useState<string>("—");
  const [lastVals, setLastVals] = useState<{ kwh?: number; volt?: number }>({});
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => stopLoop(); // cleanup
  }, []);

  const stopLoop = () => {
    setRunning(false);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const sendTick = async () => {
    // Backdate ~10s to land inside the last-15m read window
    const ts = new Date(Date.now() - 10_000).toISOString();
    const kwh  = +(3 + (Math.random() - 0.5) * 0.6).toFixed(3);  // ~3.0 ±0.3
    const volt = +(230 + (Math.random() - 0.5) * 4).toFixed(1);  // ~230 ±2.0

    const payload = {
      org_id: "test-org",
      meter: "meter-001",
      points: [
        { ts, metric: "grid_kwh",     unit: "kwh",  value: kwh },
        { ts, metric: "grid_voltage", unit: "volt", value: volt },
      ],
    };

    try {
      const res  = await fetch(`${API}/api/edge/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text().catch(() => "");
      // Try to parse queued count, fallback to +1
      let queued = 1;
      try {
        const j = JSON.parse(text);
        if (typeof j?.queued === "number") queued = j.queued;
      } catch { /* plain text */ }

      if (res.ok) {
        setSent((s) => s + queued);
        setLastVals({ kwh, volt });
        setLastMsg(`200 : ${text || "ok"}`);
      } else {
        setLastMsg(`${res.status} : ${text || "error"}`);
      }
    } catch (e: any) {
      setLastMsg(`ERR : ${e?.message ?? "Failed to fetch"}`);
    }
  };

  const loop = () => {
    if (!running) return;
    sendTick().finally(() => {
      if (!running) return;
      timerRef.current = window.setTimeout(loop, 5000);
    });
  };

  const onStart = () => {
    if (running) return;
    setSent(0);
    setLastVals({});
    setLastMsg("—");
    setRunning(true);
    loop();
  };

  const onStop = () => stopLoop();
  const onClose = () => {
    stopLoop();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
      <div className="ui-card w-[460px] max-w-[92vw] p-5">
        <div className="text-lg font-semibold mb-1">Go Live</div>
        <div className="text-sm text-app-ink-dim">
          Send demo points every ~5s via Edge (kWh + Voltage).
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-white/5 px-3 py-2">
            <div className="text-app-ink-dim">Sent</div>
            <div className="text-app-ink text-xl font-semibold">{sent}</div>
          </div>
          <div className="rounded-lg bg-white/5 px-3 py-2">
            <div className="text-app-ink-dim">Last</div>
            <div className="truncate">{lastMsg}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-white/5 px-3 py-2">
            <div className="text-app-ink-dim">kWh</div>
            <div className="text-app-ink text-base">{lastVals.kwh != null ? `${lastVals.kwh.toFixed(3)} kWh` : "—"}</div>
          </div>
          <div className="rounded-lg bg-white/5 px-3 py-2">
            <div className="text-app-ink-dim">Voltage</div>
            <div className="text-app-ink text-base">{lastVals.volt != null ? `${lastVals.volt.toFixed(1)} V` : "—"}</div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          {!running ? (
            <button className="btn btn-primary" onClick={onStart}>Start</button>
          ) : (
            <button className="btn btn-ghost" onClick={onStop}>Stop</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
