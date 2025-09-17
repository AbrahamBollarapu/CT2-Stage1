-- Optional: run as a single transaction
BEGIN;

-- Backfill the FK link so uniques can be added safely
UPDATE assessment_responses ar
SET supplier_assessment_id = sa.id
FROM supplier_assessments sa
WHERE ar.supplier_assessment_id IS NULL
  AND sa.org_id        = ar.org_id
  AND sa.supplier_id   = ar.supplier_id
  AND sa.assessment_id = ar.assessment_id;

-- Dedupe by (supplier_id, assessment_id), keep latest row
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER(
           PARTITION BY supplier_id, assessment_id
           ORDER BY created_at DESC, id DESC
         ) rn
  FROM assessment_responses
)
DELETE FROM assessment_responses ar
USING ranked r
WHERE ar.id = r.id AND r.rn > 1;

-- Ensure ON CONFLICT can target a matching unique constraint

-- supplier_assessments (supplier_id, assessment_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplier_assessments_sup_assess_uniq'
  ) THEN
    ALTER TABLE public.supplier_assessments
      ADD CONSTRAINT supplier_assessments_sup_assess_uniq
      UNIQUE (supplier_id, assessment_id);
  END IF;
END $$;

-- assessment_responses (supplier_id, assessment_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_responses_sup_assess_uniq'
  ) THEN
    ALTER TABLE public.assessment_responses
      ADD CONSTRAINT assessment_responses_sup_assess_uniq
      UNIQUE (supplier_id, assessment_id);
  END IF;
END $$;

COMMIT;
