-- 01_suppliers.sql
CREATE TABLE IF NOT EXISTS public.suppliers (
  id          BIGSERIAL PRIMARY KEY,
  org_id      TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  country     TEXT        NOT NULL DEFAULT 'IN',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- seed demo rows
INSERT INTO public.suppliers (org_id, name, country)
VALUES
  ('test-org','Traefik Test 871','IN'),
  ('test-org','Traefik Test 1754','IN')
ON CONFLICT DO NOTHING;
