-- Full path (water-market):
-- D:\water-market\apps\backend\services\evidence-store\migrations\2025-09-14_score_logic.sql
-- Full path (your CT2 tree):
-- D:\CT2\apps\backend\services\evidence-store\migrations\2025-09-14_score_logic.sql

BEGIN;

-- Safety: required for gen_random_uuid() if you use it elsewhere
CREATE EXTENSION IF NOT EXISTS pgcrypto;

--------------------------------------------------------------------------------
-- 1. Helper: calc_sum_score(assessment_id, responses)
--    Sums weights from assessments.schema->scoring->weights for every key
--    that is TRUE in the responses (accepts JSON boolean true or string "true").
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calc_sum_score(p_assessment uuid, p_responses jsonb)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
           SUM(
             CASE
               WHEN (jsonb_typeof(r.v) = 'boolean' AND r.v = to_jsonb(true))
                    OR (jsonb_typeof(r.v) = 'string' AND lower(r.v::text) = '"true"')
               THEN COALESCE((a."schema"->'scoring'->'weights'->>r.k)::int, 0)
               ELSE 0
             END
           ),
           0
         )
    FROM assessments a
    CROSS JOIN LATERAL jsonb_each(p_responses) AS r(k, v)
   WHERE a.id = p_assessment
$$;

--------------------------------------------------------------------------------
-- 2. Trigger: recompute_supplier_score on assessment_responses
--    BEFORE INSERT/UPDATE OF responses:
--      - write computed score onto assessment_responses.score
--      - upsert a mirror row into supplier_assessments for GET /score
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recompute_supplier_score()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  s integer := 0;
BEGIN
  s := calc_sum_score(NEW.assessment_id, NEW.responses);
  NEW.score := s;

  INSERT INTO supplier_assessments
    (org_id, supplier_id, assessment_id, status, score, updated_at, submitted_at)
  VALUES
    (NEW.org_id, NEW.supplier_id, NEW.assessment_id, 'scored', s, now(), now())
  ON CONFLICT (org_id, supplier_id, assessment_id)
  DO UPDATE
     SET score        = EXCLUDED.score,
         status       = 'scored',
         updated_at   = now(),
         submitted_at = COALESCE(supplier_assessments.submitted_at, now());

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS assessment_responses_score_trg ON assessment_responses;
CREATE TRIGGER assessment_responses_score_trg
BEFORE INSERT OR UPDATE OF responses ON assessment_responses
FOR EACH ROW EXECUTE FUNCTION recompute_supplier_score();

--------------------------------------------------------------------------------
-- 3. Trigger: ensure_sa_score on supplier_assessments
--    BEFORE INSERT/UPDATE:
--      - compute score from the current responses row (if present)
--      - set status/updated/submitted timestamps
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ensure_sa_score()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  r jsonb := '{}'::jsonb;
BEGIN
  SELECT ar.responses
    INTO r
    FROM assessment_responses ar
   WHERE ar.org_id        = NEW.org_id
     AND ar.supplier_id   = NEW.supplier_id
     AND ar.assessment_id = NEW.assessment_id
   LIMIT 1;

  NEW.score       := calc_sum_score(NEW.assessment_id, COALESCE(r, '{}'::jsonb));
  NEW.status      := COALESCE(NEW.status, 'scored');
  NEW.updated_at  := now();
  NEW.submitted_at:= COALESCE(NEW.submitted_at, now());

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS supplier_assessments_recalc_trg ON supplier_assessments;
CREATE TRIGGER supplier_assessments_recalc_trg
BEFORE INSERT OR UPDATE ON supplier_assessments
FOR EACH ROW EXECUTE FUNCTION ensure_sa_score();

--------------------------------------------------------------------------------
-- 4. Align conflict targets / supporting indexes (idempotent)
--------------------------------------------------------------------------------
-- Used by the UPSERT target above:
CREATE UNIQUE INDEX IF NOT EXISTS assessment_responses_org_sup_assess_uniq
  ON assessment_responses (org_id, supplier_id, assessment_id);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_assessments_org_sup_assess_uniq
  ON supplier_assessments (org_id, supplier_id, assessment_id);

-- Helpful for frequent lookups
CREATE INDEX IF NOT EXISTS assessment_responses_supplier_assessment_idx
  ON assessment_responses (supplier_id, assessment_id);

CREATE INDEX IF NOT EXISTS supplier_assessments_supplier_assessment_idx
  ON supplier_assessments (supplier_id, assessment_id);

--------------------------------------------------------------------------------
-- 5. Backfill:
--    - Recompute assessment_responses.score
--    - Mirror/refresh supplier_assessments
--------------------------------------------------------------------------------
UPDATE assessment_responses ar
   SET score = calc_sum_score(ar.assessment_id, ar.responses);

INSERT INTO supplier_assessments (org_id, supplier_id, assessment_id, status, score, updated_at, submitted_at)
SELECT ar.org_id, ar.supplier_id, ar.assessment_id, 'scored',
       calc_sum_score(ar.assessment_id, ar.responses), now(), now()
  FROM assessment_responses ar
ON CONFLICT (org_id, supplier_id, assessment_id)
DO UPDATE
   SET score        = EXCLUDED.score,
       status       = 'scored',
       updated_at   = now(),
       submitted_at = COALESCE(supplier_assessments.submitted_at, EXCLUDED.submitted_at);

COMMIT;
