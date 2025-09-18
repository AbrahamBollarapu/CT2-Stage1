-- compose/sql/2025-09-18_suppliers_hardening.sql
ALTER TABLE public.suppliers
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE public.suppliers
  ALTER COLUMN org_id  SET NOT NULL,
  ALTER COLUMN name    SET NOT NULL,
  ALTER COLUMN country SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON public.suppliers(org_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_created_at ON public.suppliers(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS u_suppliers_org_name ON public.suppliers(org_id, name);
