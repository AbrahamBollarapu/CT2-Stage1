import { apiGet } from './client';

export type KPIRes = { total_suppliers: number; compliance_score: number };

/**
 * Backend returns:
 * { org_id, kpis: [{name,value},...], updated_at }
 * Normalize to { total_suppliers, compliance_score }.
 */
export async function kpiCompute(org_id: string): Promise<KPIRes> {
  const raw = await apiGet<{ org_id: string; kpis: { name: string; value: number }[]; updated_at?: string }>(
    '/api/kpi',
    { org_id }
  );
  const map = new Map(raw.kpis?.map(k => [k.name, k.value]) ?? []);
  return {
    total_suppliers: Number(map.get('total_suppliers') ?? 0),
    compliance_score: Number(map.get('compliance_score') ?? 0),
  };
}
