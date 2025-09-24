// apps/frontend/dashboards-service/src/components/dashboard/DevicesOnlineCard.tsx
import React, { useEffect, useState } from "react";
import { Card } from "../ui";
import { getTsWindow } from "../../lib/api";

export function DevicesOnlineCard({ orgId }: { orgId: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const to = new Date();
        const from = new Date(to.getTime() - 2 * 60 * 1000); // last 2 minutes
        const r = await getTsWindow({
          org_id: orgId,
          meter: "throughput",
          unit: "count",
          from: from.toISOString(),
          to: to.toISOString(),
        });
        // Heuristic: if we saw any points in the last 2 minutes, consider the demo edge device "online"
        const online = (r.points?.length ?? 0) > 0 ? 1 : 0;
        if (!dead) setCount(online);
      } catch (e: any) {
        if (!dead) setErr(String(e?.message ?? e));
      }
    })();
    return () => { dead = true; };
  }, [orgId]);

  return (
    <Card title="Devices Online" subtitle="last 2m">
      <div className="flex items-end justify-between">
        <div className="text-3xl font-semibold">{count ?? "—"}</div>
        {err ? <div className="text-xs text-rose-500">{err}</div> : <div className="text-xs text-neutral-500">via throughput</div>}
      </div>
    </Card>
  );
}
