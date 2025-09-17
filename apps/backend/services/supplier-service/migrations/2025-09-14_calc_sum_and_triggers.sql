-- D:\CT2\apps\backend\services\supplier-service\migrations\2025-09-14_calc_sum_and_triggers.sql

BEGIN;

-- Make sure the ON CONFLICT target exists for both tables (safe if already present)
CREATE UNIQUE INDEX IF NOT EXISTS assessment_responses_org_sup_assess_uniq
  ON public.assessment_responses (org_id, supplier_id, assessment_id);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_assessments_org_sup_assess_uniq
  ON public.supplier_assessments (org_id, supplier_id, assessment_id);

-- 1) Pure helper: sum weights where response is true/"true"
CREATE OR REPLACE FUNCTION public.calc_sum_score(p_responses jsonb, p_assessment_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(COALESCE((a."schema"->'scoring'->'weights'->>rk)::int,0)),0)
    FROM public.assessments a
    CROSS JOIN LATERAL jsonb_each(p_responses) AS r(rk, rv)
   WHERE a.id = p_assessment_id
     AND (rv = to_jsonb(true) OR rv::text = 'true');
$$;

-- 2) AR trigger: compute score + mirror into supplier_assessments
CREATE OR REPLACE FUNCTION public.recompute_supplier_score()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.score := public.calc_sum_score(NEW.responses, NEW.assessment_id);

  INSERT INTO public.supplier_assessments
      (org_id, supplier_id, assessment_id, status, score, updated_at, submitted_at)
  VALUES
      (NEW.org_id, NEW.supplier_id, NEW.assessment_id, 'scored', NEW.score, now(), now())
  ON CONFLICT (org_id, supplier_id, assessment_id)
  DO UPDATE SET
      score        = EXCLUDED.score,
      status       = 'scored',
      updated_at   = now(),
      submitted_at = COALESCE(public.supplier_assessments.submitted_at, now());

  RETURN NEW;
END
$$;

-- 3) SA “meta” trigger: keep status/timestamps aligned, recompute from latest AR
CREATE OR REPLACE FUNCTION public.ensure_sa_score()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_responses jsonb;
BEGIN
  SELECT ar.responses
    INTO v_responses
    FROM public.assessment_responses ar
   WHERE ar.org_id        = NEW.org_id
     AND ar.supplier_id   = NEW.supplier_id
     AND ar.assessment_id = NEW.assessment_id
   ORDER BY ar.updated_at DESC NULLS LAST
   LIMIT 1;

  NEW.score        := COALESCE(public.calc_sum_score(COALESCE(v_responses, '{}'::jsonb), NEW.assessment_id), 0);
  NEW.status       := COALESCE(NEW.status, 'scored');
  NEW.updated_at   := now();
  NEW.submitted_at := COALESCE(NEW.submitted_at, now());
  RETURN NEW;
END
$$;

-- 4) Rewire triggers
DROP TRIGGER IF EXISTS assessment_responses_score_trg ON public.assessment_responses;
CREATE TRIGGER assessment_responses_score_trg
BEFORE INSERT OR UPDATE OF responses ON public.assessment_responses
FOR EACH ROW EXECUTE FUNCTION public.recompute_supplier_score();

DROP TRIGGER IF EXISTS supplier_assessments_recalc_trg ON public.supplier_assessments;
CREATE TRIGGER supplier_assessments_recalc_trg
BEFORE INSERT OR UPDATE ON public.supplier_assessments
FOR EACH ROW EXECUTE FUNCTION public.ensure_sa_score();

-- 5) Backfill existing supplier_assessments in one go
UPDATE public.supplier_assessments sa
   SET score        = public.calc_sum_score(ar.responses, sa.assessment_id),
       status       = 'scored',
       updated_at   = now(),
       submitted_at = COALESCE(sa.submitted_at, now())
  FROM public.assessment_responses ar
 WHERE sa.org_id        = ar.org_id
   AND sa.supplier_id   = ar.supplier_id
   AND sa.assessment_id = ar.assessment_id;

COMMIT;
