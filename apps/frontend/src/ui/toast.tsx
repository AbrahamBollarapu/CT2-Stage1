import React from "react";

type ToastVariant = "success" | "error" | "info";
type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type Ctx = {
  toast: (t: Omit<Toast, "id">) => void;
};

const ToastContext = React.createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([]);

  const toast = React.useCallback((t: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    const item: Toast = { id, durationMs: 3500, variant: "info", ...t };
    setItems((prev) => [...prev, item]);
    // auto dismiss
    const ms = item.durationMs!;
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, ms);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Viewport */}
      <div className="fixed top-4 right-4 z-[100] space-y-2 w-[320px] max-w-[calc(100vw-2rem)]">
        {items.map((t) => (
          <div
            key={t.id}
            className={[
              "rounded-xl border shadow-sm p-3 text-sm bg-white",
              t.variant === "success" && "border-green-300",
              t.variant === "error" && "border-red-300",
              t.variant === "info" && "border-gray-200",
            ].filter(Boolean).join(" ")}
            role="status"
            aria-live="polite"
          >
            {t.title && <div className="font-medium mb-0.5">{t.title}</div>}
            {t.description && (
              <div className="text-gray-600">{t.description}</div>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
