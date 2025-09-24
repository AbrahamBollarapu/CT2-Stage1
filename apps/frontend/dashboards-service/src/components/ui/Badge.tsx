// apps/frontend/dashboards-service/src/components/ui/Badge.tsx
import React from "react";

type Tone = "neutral" | "success" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

export function Badge({ children, tone = "neutral", className = "" }: React.PropsWithChildren<{ tone?: Tone; className?: string; }>) {
  return <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}
