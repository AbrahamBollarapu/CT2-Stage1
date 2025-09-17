-- 20250914_calc_sum_score_and_triggers.sql
-- Idempotent migration: helper + triggers + conflict target + backfill

BEGIN;

-- ── Prereqs (safe if already present)
ALTER TABLE assessment_responses
  ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0;

ALTER TABLE supplier_assessments
  ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- Unique arbiter for ON CONFLICT (org_id, supplier_id, assessment_id)
CREATE UNIQUE INDEX IF NOT EXISTS assessment_responses_org_sup_assess_uniq
  ON assessment_responses (org_id, supplier_id, assessment_id);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_assessments_org_sup_assess_uniq
  ON supplier_assessments (org_id, supplier_id, assessment_id);

-- ── Pure scoring helper
CREATE OR REPLACE FUNCTION calc_sum_score(responses jsonb, assess_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(COALESCE((a."schema"->'scoring'->'weights'->>k)::int, 0)), 0)
  FROM assessments a
  JOIN LATERAL jsonb_each(responses) AS r(k, v) ON true
  WHERE a.id = assess_id
    -- accept JSON boolean true or the string "true"
    AND (v = to_jsonb(true) OR v::text = 'true');
$$;

-- ── assessment_responses trigger: set NEW.score and mirror into SA
CREATE OR REPLACE FUNCTION recompute_supplier_score() RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.score := calc_sum_score(NEW.responses, NEW.assessment_id);

  INSERT INTO supplier_assessments
    (org_id, supplier_id, assessment_id, status, score, updated_at, submitted_at)
  VALUES
    (NEW.org_id, NEW.supplier_id, NEW.assessment_id, 'scored', NEW.score, now(), now())
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

-- ── supplier_assessments meta-only trigger (runs only if NEW.score IS NULL)
DROP FUNCTION IF EXISTS ensure_sa_score() CASCADE;
CREATE OR REPLACE FUNCTION ensure_sa_score() RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.score IS NULL THEN
    NEW.score := calc_sum_score(
      COALESCE((
        SELECT ar.responses
          FROM assessment_responses ar
         WHERE ar.org_id        = NEW.org_id
           AND ar.supplier_id   = NEW.supplier_id
           AND ar.assessment_id = NEW.assessment_id
      ), '{}'::jsonb),
      NEW.assessment_id
    );
  END IF;

  NEW.status        := COALESCE(NEW.status, 'scored');
  NEW.updated_at    := now();
  NEW.submitted_at  := COALESCE(NEW.submitted_at, now());
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS supplier_assessments_recalc_trg ON supplier_assessments;
CREATE TRIGGER supplier_assessments_recalc_trg
BEFORE INSERT OR UPDATE OF score ON supplier_assessments
FOR EACH ROW
WHEN (NEW.score IS NULL)
EXECUTE FUNCTION ensure_sa_score();

-- ── One-time backfill to sync SA with AR
WITH t AS (
  SELECT ar.org_id, ar.supplier_id, ar.assessment_id,
         calc_sum_score(ar.responses, ar.assessment_id) AS score
  FROM assessment_responses ar
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
