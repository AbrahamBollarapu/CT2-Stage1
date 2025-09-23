CREATE TABLE IF NOT EXISTS public.suppliers (
  id serial PRIMARY KEY,
  org_id text NOT NULL,
  name text NOT NULL,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.suppliers (org_id, name, country) VALUES
  ('test-org','Acme Fasteners','IN'),
  ('test-org','Zen Plastics','AE'),
  ('test-org','Orbit Steel','IN')
ON CONFLICT DO NOTHING;
