create extension if not exists pgcrypto;
create table if not exists evidence (
id uuid primary key default gen_random_uuid(),
org_id uuid not null,
sha256 text unique not null,
size bigint,
mime text,
path text not null,
created_at timestamptz default now()
);
create index if not exists idx_evidence_org on evidence(org_id);