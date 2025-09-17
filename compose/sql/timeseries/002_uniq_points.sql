-- compose/sql/timeseries/002_uniq_points.sql
-- Enforce one point per (org_id, meter, unit, ts)
create unique index if not exists uniq_points
  on points(org_id, meter, unit, ts);
