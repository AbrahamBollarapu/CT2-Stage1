create extension if not exists pgcrypto;
create table if not exists points (
id uuid primary key default gen_random_uuid(),
org_id uuid not null,
meter text not null,
unit text not null,
ts timestamptz not null,
value numeric not null,
tags jsonb not null default '{}'::jsonb,
created_at timestamptz default now()
);
create index if not exists idx_points_main on points(org_id, meter, unit, ts);