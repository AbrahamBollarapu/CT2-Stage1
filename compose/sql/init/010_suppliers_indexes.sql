-- 010_suppliers_indexes.sql
CREATE INDEX IF NOT EXISTS ix_suppliers_org_country
ON public.suppliers (org_id, country);
