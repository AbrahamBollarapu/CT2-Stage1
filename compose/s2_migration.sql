-- S2: Suppliers & Assessments (PostgreSQL 16)
-- Target DB: evidence (reuse the existing evidence-db)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     text NOT NULL,
  name       text NOT NULL,
  country    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_org_name_idx ON suppliers(org_id, name);
CREATE INDEX IF NOT EXISTS suppliers_org_idx ON suppliers(org_id);

-- Assessments
CREATE TABLE IF NOT EXISTS assessments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     text NOT NULL,
  title      text NOT NULL,
  version    text NOT NULL,
  schema     jsonb, -- optional metadata (questions)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS assessments_org_title_ver_idx ON assessments(org_id, title, version);
CREATE INDEX IF NOT EXISTS assessments_org_idx ON assessments(org_id);

-- Supplier ↔ Assessment assignment + score
CREATE TABLE IF NOT EXISTS supplier_assessments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        text NOT NULL,
  supplier_id   uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'assigned', -- assigned|submitted|scored
  score         numeric(5,2),
  submitted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, assessment_id)
);
CREATE INDEX IF NOT EXISTS supplier_assessments_org_status_idx ON supplier_assessments(org_id, status);
CREATE INDEX IF NOT EXISTS supplier_assessments_supplier_idx ON supplier_assessments(supplier_id);
CREATE INDEX IF NOT EXISTS supplier_assessments_assessment_idx ON supplier_assessments(assessment_id);

-- Responses payload (jsonb)
CREATE TABLE IF NOT EXISTS assessment_responses (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   text NOT NULL,
  supplier_assessment_id   uuid NOT NULL REFERENCES supplier_assessments(id) ON DELETE CASCADE,
  responses                jsonb NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assessment_responses_suppass_idx ON assessment_responses(supplier_assessment_id);
CREATE INDEX IF NOT EXISTS assessment_responses_gin ON assessment_responses USING GIN (responses);

-- Touch trigger for updated_at
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tg_suppliers_touch') THEN
    CREATE TRIGGER tg_suppliers_touch BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tg_assessments_touch') THEN
    CREATE TRIGGER tg_assessments_touch BEFORE UPDATE ON assessments
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tg_supplier_assessments_touch') THEN
    CREATE TRIGGER tg_supplier_assessments_touch BEFORE UPDATE ON supplier_assessments
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- Helpful view (latest score per supplier/assessment)
CREATE OR REPLACE VIEW supplier_scores AS
SELECT sa.id AS supplier_assessment_id,
       sa.org_id,
       sa.supplier_id,
       sa.assessment_id,
       sa.status,
       sa.score,
       sa.submitted_at,
       sa.updated_at
FROM supplier_assessments sa;
