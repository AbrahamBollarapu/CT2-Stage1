// apps/frontend/dashboards-service/src/components/ui/Skeleton.tsx
import React from "react";

type Props = {
  className?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  width?: number | string;  // e.g., 240 or "100%"
  height?: number | string; // e.g., 16 or "1.5rem"
};

const roundMap = {
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

export function Skeleton({ className = "", rounded = "lg", width = "100%", height = 16 }: Props) {
  const style: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };
  return (
    <div
      className={`${roundMap[rounded]} relative overflow-hidden bg-neutral-200 dark:bg-neutral-800 ${className}`}
      style={style}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-[ct2-skeleton_1.2s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10" />
      <style>{`
        @keyframes ct2-skeleton {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
