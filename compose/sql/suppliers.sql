create table if not exists public.suppliers (
  id serial primary key,
  org_id text not null,
  name text not null,
  country text,
  created_at timestamptz not null default now()
);

insert into public.suppliers (org_id, name, country) values
  ('test-org','Acme Fasteners','IN'),
  ('test-org','Zen Plastics','AE'),
  ('test-org','Orbit Steel','IN')
on conflict do nothing;
