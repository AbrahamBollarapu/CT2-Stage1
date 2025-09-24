// D:\CT2\apps\frontend\dashboards-service\src\lib\api.ts
export const API_BASE: string =
  ((import.meta as any).env?.VITE_API_BASE || "").replace(/\/$/, "");

export const ORG_ID = "test-org";

export function unitFor(metric: string): string | undefined {
  const map: Record<string, string> = {
    grid_kwh: "kwh",
    temp_c: "c",
    co2_ppm: "ppm",
  };
  return map[metric];
}

export async function postJson<T = any>(
  url: string,
  body: any,
  signal?: AbortSignal
): Promise<{ ok: boolean; status: number; data?: T; text?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const ct = res.headers.get("content-type") || "";
    const payload = ct.includes("application/json") ? await res.json() : await res.text();
    return { ok: res.ok, status: res.status, data: payload as T, text: String(payload) };
  } catch (e: any) {
    return { ok: false, status: 0, text: String(e?.message || e) };
  }
}

/** Preferred ingest URL then a safe fallback to direct time-series write. */
export function ingestCandidates(metric: string, meter: string) {
  const unit = unitFor(metric);
  const base = `${API_BASE}/api/time-series/points?org_id=${encodeURIComponent(ORG_ID)}&metric=${encodeURIComponent(
    metric
  )}&meter=${encodeURIComponent(meter)}${unit ? `&unit=${encodeURIComponent(unit)}` : ""}`;
  return [
    `${API_BASE}/api/edge/ingest`, // body will include unit if known
    base,
  ];
}
