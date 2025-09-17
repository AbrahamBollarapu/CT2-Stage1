\pset pager off
\timing on
\set org_id 'demo'

-- Pick one supplier and one assessment from the org
SELECT s.id AS supplier_id
  FROM suppliers s
 WHERE s.org_id = :'org_id'
 LIMIT 1;
\gset

SELECT a.id AS assessment_id
  FROM assessments a
 WHERE a.org_id = :'org_id'
 ORDER BY a.created_at DESC
 LIMIT 1;
\gset

-- Show weights for sanity
SELECT id, "schema"->'scoring'->'weights' AS weights
  FROM assessments
 WHERE id = :'assessment_id'::uuid;

-- 1) q1=true, q2=false  -> expect 5 via triggers
INSERT INTO assessment_responses (org_id, supplier_id, assessment_id, responses)
VALUES (
  :'org_id',
  :'supplier_id'::uuid,
  :'assessment_id'::uuid,
  jsonb_build_object('q1', true, 'q2', false)
)
ON CONFLICT (org_id, supplier_id, assessment_id)
DO UPDATE SET responses = EXCLUDED.responses;

SELECT responses, score
  FROM assessment_responses
 WHERE org_id = :'org_id'
   AND supplier_id = :'supplier_id'::uuid
   AND assessment_id = :'assessment_id'::uuid;

SELECT status, score, updated_at, submitted_at
  FROM supplier_assessments
 WHERE org_id = :'org_id'
   AND supplier_id = :'supplier_id'::uuid
   AND assessment_id = :'assessment_id'::uuid;

-- 2) q1=true, q2=true  -> expect 8 via triggers
INSERT INTO assessment_responses (org_id, supplier_id, assessment_id, responses)
VALUES (
  :'org_id',
  :'supplier_id'::uuid,
  :'assessment_id'::uuid,
  jsonb_build_object('q1', true, 'q2', true)
)
ON CONFLICT (org_id, supplier_id, assessment_id)
DO UPDATE SET responses = EXCLUDED.responses;

SELECT responses, score
  FROM assessment_responses
 WHERE org_id = :'org_id'
   AND supplier_id = :'supplier_id'::uuid
   AND assessment_id = :'assessment_id'::uuid;

SELECT status, score, updated_at, submitted_at
  FROM supplier_assessments
 WHERE org_id = :'org_id'
   AND supplier_id = :'supplier_id'::uuid
   AND assessment_id = :'assessment_id'::uuid;
