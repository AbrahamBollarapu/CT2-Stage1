import { apiGet } from './client';

export type Supplier = {
  id: string;
  name: string;
  country?: string;
  created_at?: string;
};

export function listSuppliers(org_id: string) {
  return apiGet<{ items: Supplier[] }>('/api/suppliers', { org_id });
}
