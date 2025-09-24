import React from "react";
import { useToast } from "./toast";
import Skeleton from "./Skeleton";

type Supplier = {
  id: number;
  org_id: string;
  name: string;
  country?: string;
  created_at: string;
};

type ApiList = {
  count: number;
  page?: number;
  page_size?: number;
  items: Supplier[];
};

const API_BASE = "/api/suppliers";
const ORG_ID = (import.meta.env.VITE_ORG_ID as string) || "test-org";
const API_KEY = (import.meta.env.VITE_API_KEY as string) || "ct2-dev-key";

export default function Suppliers() {
  const [items, setItems] = React.useState<Supplier[]>([]);
  const [count, setCount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(25);
  const [country, setCountry] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const load = React.useCallback(async (nextPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const u = new URL(API_BASE, window.location.origin);
      u.searchParams.set("org_id", ORG_ID);
      u.searchParams.set("page", String(nextPage));
      u.searchParams.set("page_size", String(pageSize));
      if (country) u.searchParams.set("country", country);

      const res = await fetch(u.toString().replace(window.location.origin, ""), {
        headers: { "x-api-key": API_KEY },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json: ApiList = await res.json();
      setItems(json.items || []);
      setCount(json.count || 0);
      setPage(json.page || nextPage);
    } catch (e: any) {
      setError(e.message || "failed to load");
      setItems([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, country]);

  // toast once when error changes
  React.useEffect(() => {
    if (error) {
      toast({ variant: "error", title: "Failed to load suppliers", description: error });
    }
  }, [error, toast]);

  React.useEffect(() => {
    load(1);
  }, [country]); // reset to page 1 when filter changes

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <div className="flex gap-2">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">All countries</option>
            <option value="IN">IN</option>
            <option value="AE">AE</option>
            <option value="US">US</option>
          </select>
          <button
            onClick={() => load(1)}
            className="border rounded-lg px-3 py-1.5 text-sm hover:bg-gray-100"
            title="Reload"
          >
            ↻
          </button>
        </div>
      </div>

      <div className="rounded-xl border shadow-sm">
        {loading && !items.length ? (
          <div className="p-6">
            <Skeleton className="h-5 w-1/3 mb-4" />
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-lg font-medium">No suppliers yet</div>
            <div className="text-sm text-gray-500 mt-1">
              When you add suppliers for <span className="font-mono">{ORG_ID}</span>, they’ll show up here.
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="p-3 border-b">ID</th>
                    <th className="p-3 border-b">Name</th>
                    <th className="p-3 border-b">Country</th>
                    <th className="p-3 border-b">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id} className="odd:bg-white even:bg-gray-50">
                      <td className="p-3 border-b font-mono">{s.id}</td>
                      <td className="p-3 border-b">{s.name}</td>
                      <td className="p-3 border-b">{s.country || "—"}</td>
                      <td className="p-3 border-b">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-3 border-t">
              <div className="text-xs text-gray-500">
                Page <span className="font-medium">{page}</span> of{" "}
                <span className="font-medium">{totalPages}</span> •{" "}
                <span className="font-medium">{count}</span> total
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => load(page - 1)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${page <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"}`}
                >
                  ← Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => load(page + 1)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${page >= totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"}`}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
