// apps/frontend/dashboards-service/src/ui/Suppliers.tsx
import React, { useEffect, useMemo, useState } from "react";
import ExportCsvButton from "../components/actions/ExportCsvButton";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../ui/toast";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");
const H: HeadersInit = { "x-api-key": "ct2-dev-key", "content-type": "application/json" };
const ORG_ID = "test-org";

type Supplier = {
  id: number;
  org_id: string;
  name: string;
  country?: string;
  created_at?: string;
};

export default function Suppliers() {
  const { push } = useToast();

  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState<string>("");
  const [country, setCountry] = useState<string>("");

  useEffect(() => {
    let dead = false;
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/suppliers?org_id=${encodeURIComponent(ORG_ID)}`, { headers: H });
        if (!r.ok) throw new Error(`suppliers_${r.status}`);
        const data: Supplier[] = await r.json();
        if (!dead) { setRows(data); setErr(null); }
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (!dead) { setErr(msg); push({ tone: "danger", title: "Failed to load suppliers", description: msg }); }
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [push]);

  const countries = useMemo(() => {
    const set = new Set((rows ?? []).map(r => (r.country ?? "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(r => {
      const okQ = !needle || r.name?.toLowerCase().includes(needle) || String(r.id).includes(needle);
      const okC = !country || (r.country ?? "") === country;
      return okQ && okC;
    });
  }, [rows, q, country]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Suppliers</h2>
          <p className="text-xs text-neutral-500">Live list from supplier-service</p>
        </div>
        <ExportCsvButton
          data={filtered}
          headers={["id", "org_id", "name", "country", "created_at"]}
          filename="suppliers.csv"
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-neutral-500 mb-1">Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 ring-black/10 dark:ring-white/20"
            placeholder="Search by name or ID…"
          />
        </div>
        <div className="w-[180px]">
          <label className="block text-xs text-neutral-500 mb-1">Country</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none"
          >
            <option value="">All</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Table / Skeleton / Error */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton height={36} />
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={20} />)}
        </div>
      ) : err ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 text-rose-700 p-4 text-sm">
          {err}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-neutral-500">
          No suppliers found. Adjust filters or try a different search.
        </div>
      ) : (
        <div className="overflow-auto rounded-2xl border border-black/5">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900/60">
              <tr>
                {["ID", "Name", "Country", "Created"].map(h => (
                  <th key={h} className="text-left font-semibold px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
                  <td className="px-3 py-2 w-[80px] tabular-nums">{r.id}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 w-[120px]">{r.country ?? "-"}</td>
                  <td className="px-3 py-2 w-[160px]">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
