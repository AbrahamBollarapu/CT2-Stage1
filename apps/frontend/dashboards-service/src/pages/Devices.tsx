import React from "react";
import { useEdgeHealth, timeAgo } from "../hooks/useEdgeHealth";

export default function DevicesPage() {
  const { data, error, refresh } = useEdgeHealth({ intervalMs: 5000 });

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Devices</h1>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
              data?.ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"
            }`}
            title={data?.ok ? "Edge gateway healthy" : "Edge gateway offline"}
          >
            <span
              className={`h-2 w-2 rounded-full ${data?.ok ? "bg-emerald-500" : "bg-rose-500"}`}
            />
            {data?.ok ? "Online" : "Offline"}
          </span>
          <button
            onClick={refresh}
            className="rounded-md border border-zinc-200 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50 active:scale-[.99] dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          Edge health error: {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Gateway</div>
          <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{data?.device ?? "—"}</div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <div><dt className="text-zinc-500">MQTT</dt><dd>{data?.mqtt ? "Connected" : "Not connected"}</dd></div>
            <div><dt className="text-zinc-500">Buffered</dt><dd>{data?.buffered ?? 0}</dd></div>
            <div><dt className="text-zinc-500">Last Ingest</dt><dd>{timeAgo(data?.lastPostAt)}</dd></div>
            <div><dt className="text-zinc-500">Service</dt><dd>{data?.svc ?? "edge-gateway"}</dd></div>
          </dl>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Config</div>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <div><dt className="text-zinc-500">Org</dt><dd>{data?.config?.org ?? "—"}</dd></div>
            <div><dt className="text-zinc-500">Meter</dt><dd>{data?.config?.meter ?? "—"}</dd></div>
            <div><dt className="text-zinc-500">Unit</dt><dd>{data?.config?.unit ?? "—"}</dd></div>
            <div><dt className="text-zinc-500">Sim</dt><dd>{String(data?.config?.sim ?? false)}</dd></div>
            <div><dt className="text-zinc-500">Flush</dt><dd>{(data?.config?.post_ms ?? 0) + " ms"}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
