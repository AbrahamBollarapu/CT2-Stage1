// apps/frontend/dashboards-service/src/components/ui/Drawer.tsx
import React, { useEffect } from "react";

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div className={`absolute right-0 top-0 h-full w-[420px] bg-white dark:bg-neutral-900 shadow-xl transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold flex items-center justify-between">
          <div>{title}</div>
          <button className="text-neutral-500 hover:text-neutral-700" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="p-4 overflow-auto h-[calc(100%-48px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
