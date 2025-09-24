// apps/frontend/dashboards-service/src/ui/Toast.tsx
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

// Optional host (kept for compatibility). Not required because the provider renders the viewport.
export default function ToastHost() { return null; }

type Tone = "neutral" | "success" | "warning" | "danger";

type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  tone?: Tone;
  duration?: number; // ms, default 3500
};

type Toast = Required<ToastInput> & { id: string; createdAt: number };

type ToastApi = {
  push: (t: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

function toneClasses(tone: Tone) {
  switch (tone) {
    case "success": return "bg-emerald-600 text-white";
    case "warning": return "bg-amber-600 text-white";
    case "danger":  return "bg-rose-600 text-white";
    default:        return "bg-neutral-800 text-white";
  }
}

export function ToastProvider({ children }: React.PropsWithChildren) {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismiss = useCallback((id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    const t = timers.current[id];
    if (t) { window.clearTimeout(t); delete timers.current[id]; }
  }, []);

  const push = useCallback((t: ToastInput) => {
    const id = Math.random().toString(36).slice(2);
    const tone: Tone = t.tone ?? "neutral";
    const duration = Number.isFinite(t.duration) ? (t.duration as number) : 3500;
    const next: Toast = {
      id,
      title: t.title ?? "Notice",
      description: t.description ?? "",
      tone,
      duration,
      createdAt: Date.now(),
    };
    setItems((xs) => [next, ...xs].slice(0, 5));
    timers.current[id] = window.setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const clear = useCallback(() => {
    setItems([]);
    Object.values(timers.current).forEach((t) => window.clearTimeout(t));
    timers.current = {};
  }, []);

  const api = useMemo<ToastApi>(() => ({ push, dismiss, clear }), [push, dismiss, clear]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* Viewport */}
      <div className="fixed bottom-4 right-4 z-[1000] flex flex-col gap-3 w-[320px] max-w-[calc(100vw-1.5rem)]">
        {items.map((x) => (
          <div
            key={x.id}
            className={`rounded-2xl shadow-lg border border-black/10 overflow-hidden ${toneClasses(x.tone)}`}
            role="status"
            aria-live="polite"
          >
            <div className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1">
                {x.title ? <div className="text-sm font-semibold leading-5">{x.title}</div> : null}
                {x.description ? <div className="text-xs/5 opacity-90 mt-0.5">{x.description}</div> : null}
              </div>
              <button
                aria-label="Dismiss"
                className="text-white/80 hover:text-white text-sm"
                onClick={() => dismiss(x.id)}
              >
                ✕
              </button>
            </div>
            <div className="h-1 w-full bg-black/15">
              <div
                className="h-1 bg-white/80"
                style={{
                  width: "100%",
                  animation: `ct2-toast-progress ${x.duration}ms linear forwards`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* progress bar keyframes */}
      <style>{`
        @keyframes ct2-toast-progress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </ToastCtx.Provider>
  );
}
