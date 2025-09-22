import React, { useEffect, useMemo, useState } from "react";

type ReportRow = {
  id: string | number;
  name: string;
  status: "queued" | "running" | "success" | "failed";
  started_at?: string;
  finished_at?: string;
  url?: string;
};

const ORG = (import.meta.env.VITE_ORG_ID as string) || "test-org";
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";
const API_KEY = (import.meta.env.VITE_API_KEY as string) || "ct2-dev-key";

export default function Reports() {
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/reports?org_id=${encodeURIComponent(ORG)}`, {
        headers: { "x-api-key": API_KEY },
      });

      // Treat "backend not up yet" as coming soon (404) or upstream missing (502)
      if (res.status === 404 || res.status === 502) {
        setRows([]);
        setErr("coming-soon");
        return;
      }
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as ReportRow[];
      setRows(data);
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  const hasData = useMemo(() => (rows?.length ?? 0) > 0, [rows]);

  if (loading) return <div>Loading…</div>;
  if (err === "coming-soon") return <div>Reports (coming soon)</div>;
  if (err) return <div style={{ color: "crimson" }}>Error: {err}</div>;
  if (!hasData)
    return (
      <div>
        <div style={{ marginBottom: 12 }}>No reports yet.</div>
        <button onClick={load}>Refresh</button>
      </div>
    );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Reports</h2>
        <button onClick={load}>Refresh</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr><Th>ID</Th><Th>Name</Th><Th>Status</Th><Th>Started</Th><Th>Finished</Th><Th>Link</Th></tr>
          </thead>
          <tbody>
            {rows!.map((r) => (
              <tr key={String(r.id)}>
                <Td mono>{r.id}</Td>
                <Td>{r.name}</Td>
                <Td><StatusChip status={r.status} /></Td>
                <Td>{r.started_at ? new Date(r.started_at).toLocaleString() : "—"}</Td>
                <Td>{r.finished_at ? new Date(r.finished_at).toLocaleString() : "—"}</Td>
                <Td>{r.url ? <a href={r.url} target="_blank" rel="noreferrer">open</a> : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #eee", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return <td style={{ padding: "8px 10px", borderBottom: "1px solid #f5f5f5", fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" : undefined, fontSize: 13, whiteSpace: "nowrap" }}>{children}</td>;
}
function StatusChip({ status }: { status: "queued" | "running" | "success" | "failed" }) {
  const map = {
    queued:  { bg: "#f3f5ff", fg: "#2d3fe0", label: "queued" },
    running: { bg: "#fff5e5", fg: "#a35a00", label: "running" },
    success: { bg: "#e7f8ee", fg: "#0a7f2e", label: "success" },
    failed:  { bg: "#fdeaea", fg: "#a51d2d", label: "failed" },
  } as const;
  const s = (map as any)[status] ?? map.queued;
  return <span style={{ padding: "2px 8px", borderRadius: 999, background: s.bg, color: s.fg, fontSize: 12 }}>{s.label}</span>;
}
