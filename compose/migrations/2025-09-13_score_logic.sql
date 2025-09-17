-- ============================================
-- Scoring logic: function + triggers + backfill
-- Standardizes on ON CONFLICT (org_id, supplier_id, assessment_id)
-- ============================================

BEGIN;

-- (A) Optional: remove the legacy 2-key uniques to avoid ambiguity
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='assessment_responses_sup_assess_uniq'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS assessment_responses_sup_assess_uniq';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='supplier_assessments_sup_assess_uniq'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS supplier_assessments_sup_assess_uniq';
  END IF;
END$$;

-- (B) Ensure we have a triple-unique on assessment_responses
-- (supplier_assessments already has composite PK on (org_id, supplier_id, assessment_id))
DO $$
BEGIN
  ALTER TABLE assessment_responses
    ADD CONSTRAINT assessment_responses_org_sup_assess_uniq
    UNIQUE (org_id, supplier_id, assessment_id);
EXCEPTION WHEN duplicate_object THEN
  -- already exists; carry on
END$$;

-- (C) Pure scoring function that both triggers (and the service) can reuse
CREATE OR REPLACE FUNCTION calc_sum_score(a_schema jsonb, answers jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE((
    SELECT SUM( COALESCE( (a_schema->'scoring'->'weights'->>k)::int, 0) )
    FROM jsonb_each(answers) AS r(k, v)
    WHERE v = to_jsonb(true) OR v::text = 'true'   -- accept JSON true or string "true"
  ), 0)
$$;

-- (D) Trigger on assessment_responses: compute NEW.score and mirror to supplier_assessments
CREATE OR REPLACE FUNCTION recompute_supplier_score()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  new_score integer := 0;
BEGIN
  SELECT calc_sum_score(a."schema", NEW.responses)
    INTO new_score
  FROM assessments a
  WHERE a.id = NEW.assessment_id;

  -- write score onto the row being inserted/updated
  NEW.score := new_score;

  -- mirror to supplier_assessments so GET /score is instantaneous
  INSERT INTO supplier_assessments
    (org_id, supplier_id, assessment_id, status, score, updated_at, submitted_at)
  VALUES
    (NEW.org_id, NEW.supplier_id, NEW.assessment_id, 'scored', new_score, now(), now())
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

-- (E) Failsafe trigger on supplier_assessments:
--     if someone upserts here directly, we still calculate a consistent score.
CREATE OR REPLACE FUNCTION ensure_sa_score()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  computed integer;
BEGIN
  SELECT calc_sum_score(a."schema", ar.responses)
    INTO computed
  FROM assessments a
  JOIN assessment_responses ar
    ON ar.assessment_id = a.id
   AND ar.org_id        = NEW.org_id
   AND ar.supplier_id   = NEW.supplier_id
   AND ar.assessment_id = NEW.assessment_id;

  IF computed IS NOT NULL THEN
    NEW.score  := computed;
    NEW.status := COALESCE(NEW.status, 'scored');
  END IF;

  NEW.updated_at   := now();
  NEW.submitted_at := COALESCE(NEW.submitted_at, now());
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS supplier_assessments_recalc_trg ON supplier_assessments;
CREATE TRIGGER supplier_assessments_recalc_trg
BEFORE INSERT OR UPDATE ON supplier_assessments
FOR EACH ROW EXECUTE FUNCTION ensure_sa_score();

-- (F) Backfill everything that already exists
-- 1) Ensure every response has a matching supplier_assessments row with correct score
INSERT INTO supplier_assessments (org_id, supplier_id, assessment_id, status, score, updated_at, submitted_at)
SELECT
  ar.org_id, ar.supplier_id, ar.assessment_id,
  'scored',
  calc_sum_score(a."schema", ar.responses),
  now(), now()
FROM assessment_responses ar
JOIN assessments a ON a.id = ar.assessment_id
ON CONFLICT (org_id, supplier_id, assessment_id)
DO UPDATE
   SET score        = EXCLUDED.score,
       status       = 'scored',
       updated_at   = now(),
       submitted_at = COALESCE(supplier_assessments.submitted_at, now());

-- 2) Normalize any lingering supplier_assessments rows to computed score (safety)
WITH t AS (
  SELECT ar.org_id, ar.supplier_id, ar.assessment_id,
         calc_sum_score(a."schema", ar.responses) AS score
  FROM assessment_responses ar
  JOIN assessments a ON a.id = ar.assessment_id
)
UPDATE supplier_assessments sa
SET score        = t.score,
    status       = 'scored',
    updated_at   = now(),
    submitted_at = COALESCE(sa.submitted_at, now())
FROM t
WHERE sa.org_id = t.org_id
  AND sa.supplier_id = t.supplier_id
  AND sa.assessment_id = t.assessment_id;

COMMIT;
