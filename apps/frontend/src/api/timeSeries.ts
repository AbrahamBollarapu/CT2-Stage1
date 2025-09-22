import { apiGet } from './client';

export type SeriesPoint = { ts: string; value: number };
export type SeriesRes = { meter: string; unit: string; points: SeriesPoint[] };

export interface SeriesParams {
  org_id: string;
  meter: string; // e.g., 'throughput'
  unit: string;  // e.g., 'count'
  from: string;  // ISO string
  to: string;    // ISO string
}

/**
 * Calls GET /api/time-series/points?org_id=&meter=&unit=&from=&to=
 */
export async function tsRead(p: SeriesParams): Promise<SeriesRes> {
  return apiGet<SeriesRes>('/api/time-series/points', {
    org_id: p.org_id,
    meter: p.meter,
    unit: p.unit,
    from: p.from,
    to: p.to,
  });
}
