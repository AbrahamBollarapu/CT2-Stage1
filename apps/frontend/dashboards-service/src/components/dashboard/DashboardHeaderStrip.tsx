// apps/frontend/dashboards-service/src/components/dashboard/DashboardHeaderStrip.tsx
import React from "react";
import { Badge } from "../ui/Badge";

export function DashboardHeaderStrip({ pointsWindow, lastUpdated }: { pointsWindow: "7d" | "30d"; lastUpdated?: Date | null; }) {
  const ago = lastUpdated ? Math.max(1, Math.round((Date.now() - lastUpdated.getTime()) / 1000)) : null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
      <Badge>Window: {pointsWindow}</Badge>
      {ago ? <span>• last updated {ago}s ago</span> : null}
    </div>
  );
}
