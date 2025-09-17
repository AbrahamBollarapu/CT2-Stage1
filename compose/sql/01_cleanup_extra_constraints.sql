BEGIN;

-- ========== assessment_responses ==========
-- Drop redundant uniques / indexes
ALTER TABLE public.assessment_responses
  DROP CONSTRAINT IF EXISTS assessment_responses_org_sup_assess_uidx,
  DROP CONSTRAINT IF EXISTS assessment_responses_org_sup_assess_uniq,
  DROP CONSTRAINT IF EXISTS assessment_responses_sup_assess_org_uniq2,
  DROP CONSTRAINT IF EXISTS assessment_responses_sup_org_assess_uniq;

-- This was a standalone unique index (not a constraint)
DROP INDEX IF EXISTS ar_org_sup_assess_idx;

-- Keep these two; ensure they exist (idempotent guards)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_responses_sup_assess_uniq'
  ) THEN
    ALTER TABLE public.assessment_responses
      ADD CONSTRAINT assessment_responses_sup_assess_uniq
      UNIQUE (supplier_id, assessment_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_responses_supplier_assessment_uidx'
  ) THEN
    ALTER TABLE public.assessment_responses
      ADD CONSTRAINT assessment_responses_supplier_assessment_uidx
      UNIQUE (supplier_assessment_id);
  END IF;
END $$;

-- ========== supplier_assessments ==========
-- Drop redundant uniques
ALTER TABLE public.supplier_assessments
  DROP CONSTRAINT IF EXISTS supplier_assessments_org_sup_assess_uidx,
  DROP CONSTRAINT IF EXISTS supplier_assessments_org_sup_assess_uniq,
  DROP CONSTRAINT IF EXISTS supplier_assessments_sup_assess_org_uniq;

-- Keep / ensure this one
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

COMMIT;
