-- Safe, additive hardening for public.suppliers
-- Run on ct2-evidence-db (psql) – idempotent

-- 1) created_at default (if missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='suppliers'
               AND column_name='created_at' AND column_default IS NULL) THEN
    EXECUTE 'ALTER TABLE public.suppliers ALTER COLUMN created_at SET DEFAULT NOW()';
  END IF;
END$$;

-- 2) non-null constraints (only if currently nullable)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='suppliers'
               AND column_name='org_id' AND is_nullable='YES') THEN
    EXECUTE 'ALTER TABLE public.suppliers ALTER COLUMN org_id SET NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='suppliers'
               AND column_name='name' AND is_nullable='YES') THEN
    EXECUTE 'ALTER TABLE public.suppliers ALTER COLUMN name SET NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='suppliers'
               AND column_name='country' AND is_nullable='YES') THEN
    EXECUTE 'ALTER TABLE public.suppliers ALTER COLUMN country SET NOT NULL';
  END IF;
END$$;

-- 3) indexes (common filters/sorts)
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON public.suppliers(org_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_created_at ON public.suppliers(created_at DESC);

-- 4) dedupe guard (per-org unique name)
CREATE UNIQUE INDEX IF NOT EXISTS u_suppliers_org_name ON public.suppliers(org_id, name);
