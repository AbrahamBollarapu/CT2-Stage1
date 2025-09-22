import { useEffect, useState } from 'react'
const API = (import.meta.env.VITE_API_BASE as string) || '/api'

export default function SuppliersCard({ org_id }: { org_id: string }) {
  const [rows, setRows] = useState<any[]|null>(null)
  const [err, setErr]   = useState<string|undefined>()

  useEffect(() => {
    setRows(null); setErr(undefined)
    fetch(`${API}/suppliers`, { headers: { 'x-org-id': org_id } })
      .then(r => r.ok ? r.json() : Promise.reject(`${r.status}`))
      .then(setRows)
      .catch(e => setErr(String(e)))
  }, [org_id])

  return (
    <div className="bg-white p-4 rounded-2xl shadow">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Suppliers</h3>
        <span className="text-xs text-gray-500">org: {org_id}</span>
      </div>

      {err && <div className="mt-2 p-2 text-sm bg-red-50 text-red-700 rounded">{err}</div>}
      {!rows && !err && <div className="mt-2 text-sm text-gray-500">Loading…</div>}
      {rows && rows.length === 0 && <div className="mt-2 text-sm text-gray-500">No suppliers yet.</div>}

      {rows && rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-1 pr-4">ID</th>
                <th className="py-1 pr-4">Name</th>
                <th className="py-1 pr-4">Country</th>
                <th className="py-1">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r:any)=>(
                <tr key={r.id} className="border-t">
                  <td className="py-1 pr-4">{r.id}</td>
                  <td className="py-1 pr-4">{r.name}</td>
                  <td className="py-1 pr-4">{r.country}</td>
                  <td className="py-1">{(r.created_at||'').slice(0,10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
